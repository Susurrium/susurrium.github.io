import {
  globeFitPaddingForDistance,
  globeFitZoomForDistance,
  globeFlyDuration,
  haversineDistanceKm,
  shortestLongitudeFrom,
  type Coordinate,
} from './residence-map-geometry';

type MapLibreApi = typeof import('maplibre-gl');
type MapInstance = import('maplibre-gl').Map;
type MarkerInstance = import('maplibre-gl').Marker;

// MapLibre's already-built UMD bundle is intentionally served from public/
// and loaded only once the residence card approaches the viewport.  It must be
// appended as a normal script rather than passed to import(): Vite treats files
// in public/ as opaque browser assets and refuses to transform them as modules.
// The pinned package remains installed solely for exact TypeScript API types.
const basePath = import.meta.env.BASE_URL === '/' ? '' : import.meta.env.BASE_URL.replace(/\/$/, '');
const mapLibreScriptUrl = `${basePath}/vendor/maplibre-gl@5.24.0/maplibre-gl.js`;
const mapLibreCssUrl = `${basePath}/vendor/maplibre-gl@5.24.0/maplibre-gl.css`;

let mapScriptPromise: Promise<MapLibreApi> | undefined;
let stylesheetPromise: Promise<HTMLLinkElement> | undefined;
let stylesheetLink: HTMLLinkElement | undefined;
let stylesheetReferences = 0;
let clientRouterHookInstalled = false;

async function loadMapLibre() {
  const globalWindow = window as typeof window & { maplibregl?: MapLibreApi };
  if (globalWindow.maplibregl) return globalWindow.maplibregl;

  if (!mapScriptPromise) {
    const existing = document.head.querySelector<HTMLScriptElement>('[data-residence-maplibre]');
    const script = existing ?? document.createElement('script');
    if (!existing) {
      script.src = mapLibreScriptUrl;
      script.async = true;
      script.dataset.residenceMaplibre = '';
    }
    mapScriptPromise = new Promise<MapLibreApi>((resolve, reject) => {
      const cleanup = () => {
        script.removeEventListener('load', onLoad);
        script.removeEventListener('error', onError);
        window.clearTimeout(timeout);
      };
      const onLoad = () => {
        cleanup();
        const api = globalWindow.maplibregl;
        if (api) resolve(api);
        else {
          script.remove();
          reject(new Error('MapLibre runtime did not expose maplibregl'));
        }
      };
      const onError = () => {
        cleanup();
        script.remove();
        reject(new Error('MapLibre runtime failed to load'));
      };
      const timeout = window.setTimeout(() => {
        cleanup();
        script.remove();
        reject(new Error('MapLibre runtime load timed out'));
      }, 8_000);
      script.addEventListener('load', onLoad, { once: true });
      script.addEventListener('error', onError, { once: true });
      if (globalWindow.maplibregl) onLoad();
      else if (!existing) document.head.append(script);
    });
  }
  return mapScriptPromise.catch((error: unknown) => {
    // A network hiccup must not permanently cache a rejected public script.
    mapScriptPromise = undefined;
    throw error;
  });
}

async function acquireMapLibreStylesheet() {
  stylesheetReferences += 1;
  if (stylesheetLink && document.head.contains(stylesheetLink)) return Promise.resolve(stylesheetLink);
  if (stylesheetPromise) {
    return stylesheetPromise.catch((error: unknown) => {
      releaseMapLibreStylesheet();
      throw error;
    });
  }

  const existing = document.head.querySelector<HTMLLinkElement>('[data-residence-maplibre-css]');
  if (existing) {
    stylesheetLink = existing;
    return Promise.resolve(existing);
  }

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = mapLibreCssUrl;
  link.dataset.residenceMaplibreCss = '';
  stylesheetLink = link;
  stylesheetPromise = new Promise<HTMLLinkElement>((resolve, reject) => {
    const onLoad = () => {
      link.removeEventListener('load', onLoad);
      link.removeEventListener('error', onError);
      resolve(link);
    };
    const onError = () => {
      link.removeEventListener('load', onLoad);
      link.removeEventListener('error', onError);
      link.remove();
      stylesheetLink = undefined;
      stylesheetPromise = undefined;
      reject(new Error('MapLibre stylesheet failed to load'));
    };
    link.addEventListener('load', onLoad, { once: true });
    link.addEventListener('error', onError, { once: true });
    document.head.append(link);
  });
  return stylesheetPromise.catch((error: unknown) => {
    releaseMapLibreStylesheet();
    throw error;
  });
}

function releaseMapLibreStylesheet() {
  stylesheetReferences = Math.max(0, stylesheetReferences - 1);
  if (stylesheetReferences > 0) return;
  stylesheetLink?.remove();
  stylesheetLink = undefined;
  stylesheetPromise = undefined;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string) {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

function isDarkTheme() {
  return (
    document.documentElement.dataset.theme === 'dark' ||
    document.documentElement.classList.contains('dark')
  );
}

function waitForMapLoad(map: MapInstance) {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      map.off('load', onLoad);
      map.off('error', onError);
      window.clearTimeout(timeout);
    };
    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };
    const onLoad = () => settle(resolve);
    const onError = (event: unknown) => settle(() => reject(event instanceof Error ? event : new Error('MapLibre map failed to load')));
    const timeout = window.setTimeout(() => settle(() => reject(new Error('MapLibre map load timed out'))), 8_000);
    map.once('load', onLoad);
    map.on('error', onError);
  });
}

const chineseMapLabelExpression = [
  'coalesce',
  ['get', 'name:zh'],
  ['get', 'name'],
  ['get', 'name_en'],
] as const;

function applyChineseMapLabels(map: MapInstance) {
  for (const layer of map.getStyle().layers) {
    if (layer.type !== 'symbol' || layer.id === 'housenumber') continue;
    if (!layer.layout?.['text-field']) continue;
    map.setLayoutProperty(layer.id, 'text-field', chineseMapLabelExpression);
  }
}

function createAvatarMarker(
  api: MapLibreApi,
  map: MapInstance,
  kind: 'residence' | 'visitor',
  coordinates: Coordinate,
  avatarUrl: string,
  alt: string,
) {
  const markerNode = document.createElement('span');
  markerNode.className = 'residence-map__marker-node';
  markerNode.dataset.globeMarker = kind;
  markerNode.setAttribute('aria-label', alt);

  const avatar = document.createElement('span');
  avatar.className = `residence-map__avatar-marker residence-map__avatar-marker--${kind}`;
  const image = document.createElement('img');
  image.dataset.globeAvatar = '';
  image.src = avatarUrl;
  image.alt = alt;
  image.width = kind === 'visitor' ? 28 : 32;
  image.height = kind === 'visitor' ? 28 : 32;
  image.addEventListener('error', () => {
    image.remove();
    avatar.dataset.avatarFallback = '';
  });
  avatar.append(image);
  const arrow = document.createElement('span');
  arrow.className = 'residence-map__marker-arrow';
  arrow.dataset.globeArrow = '';
  arrow.setAttribute('aria-hidden', 'true');
  const dot = document.createElement('span');
  dot.className = 'residence-map__marker-dot';
  dot.dataset.globeDot = '';
  dot.setAttribute('aria-hidden', 'true');
  markerNode.append(avatar, arrow, dot);

  const marker = new api.Marker({ element: markerNode, anchor: 'bottom' }).setLngLat(coordinates).addTo(map);
  marker.getElement().removeAttribute('role');
  return marker;
}

function createNormalMarker(api: MapLibreApi, map: MapInstance, coordinates: Coordinate) {
  const markerNode = document.createElement('span');
  markerNode.className = 'residence-map__live-marker';
  markerNode.setAttribute('aria-hidden', 'true');
  const pulse = document.createElement('span');
  pulse.className = 'residence-map__live-marker-pulse';
  const pin = document.createElement('span');
  pin.className = 'residence-map__live-marker-pin';
  markerNode.append(pulse, pin);
  const marker = new api.Marker({ element: markerNode, anchor: 'center' }).setLngLat(coordinates).addTo(map);
  marker.getElement().removeAttribute('role');
  return marker;
}

function setupResidenceScene(scene: HTMLElement) {
  const mapHost = scene.querySelector<HTMLElement>('[data-map-canvas]');
  const card = scene.closest<HTMLElement>('.residence-card') ?? scene;
  const dialog = card.querySelector<HTMLDialogElement>('[data-globe-dialog]');
  const globeCanvas = dialog?.querySelector<HTMLElement>('[data-globe-canvas]');
  const globeHost = dialog?.querySelector<HTMLElement>('[data-globe-map-host]');
  const globeLoading = dialog?.querySelector<HTMLElement>('[data-globe-loading]');
  const globeStatus = dialog?.querySelector<HTMLElement>('[data-globe-status]');
  const globeTrigger = scene.querySelector<HTMLButtonElement>('[data-globe-trigger]');
  const maximizeButton = scene.querySelector<HTMLButtonElement>('[data-map-maximize]');
  const locationButtons = Array.from(card.querySelectorAll<HTMLButtonElement>('[data-visitor-location]'));
  if (!mapHost) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const owner: Coordinate = [Number(scene.dataset.longitude), Number(scene.dataset.latitude)];
  const lightStyle = scene.dataset.mapStyle ?? '';
  const darkStyle = scene.dataset.mapDarkStyle || lightStyle;
  const ownerAvatar = scene.dataset.ownerAvatar || '/images/profile.svg';
  const visitorAvatar = scene.dataset.visitorAvatar || '/images/placeholders/visitor-avatar.svg';

  let map: MapInstance | undefined;
  let normalMarker: MarkerInstance | undefined;
  let mainStyleUrl = '';
  let mapCssAcquired = false;
  let mapLoaded = false;
  let mapStarting = false;
  let mapAttempted = false;
  let globeMap: MapInstance | undefined;
  let globeStyleUrl = '';
  let globeCssAcquired = false;
  let globeOwnerMarker: MarkerInstance | undefined;
  let globeVisitorMarker: MarkerInstance | undefined;
  let globeRouteElement: HTMLElement | undefined;
  let globeStarting: Promise<void> | undefined;
  let globeGeneration = 0;
  let visitorCoordinates: Coordinate | undefined;
  let geolocationPermission: PermissionStatus | undefined;
  let closingTimer: number | undefined;
  let disposed = false;
  let suspended = false;
  let preloadIntersecting = false;
  let visibleIntersecting = false;
  let previousFocus: HTMLElement | null = null;
  let bodyOverflow = '';

  const setGlobeState = (state: 'idle' | 'loading' | 'ready' | 'error' | 'closing') => {
    if (dialog) dialog.dataset.globeState = state;
    if (globeCanvas) globeCanvas.dataset.globeState = state;
    if (globeLoading) globeLoading.hidden = state !== 'loading';
  };

  const setGlobeStatus = (message: string) => {
    if (globeStatus) globeStatus.textContent = message;
  };

  const setFlightState = () => {
    const active = !disposed && visibleIntersecting && !document.hidden && !reducedMotion.matches;
    scene.dataset.flightActive = String(active);
  };

  const removeMainMap = () => {
    try {
      map?.stop();
      map?.remove();
    } catch {
      // MapLibre teardown can throw while a style request is still resolving.
    }
    map = undefined;
    mainStyleUrl = '';
    normalMarker?.remove();
    normalMarker = undefined;
    mapLoaded = false;
    mapHost.replaceChildren();
    if (mapCssAcquired) {
      releaseMapLibreStylesheet();
      mapCssAcquired = false;
    }
  };

  const useFallback = () => {
    if (disposed) return;
    scene.dataset.mapState = 'fallback';
    removeMainMap();
  };

  const startMainMap = async () => {
    if (disposed || mapStarting || mapAttempted || !preloadIntersecting || document.hidden) return;
    if (!Number.isFinite(owner[0]) || !Number.isFinite(owner[1]) || !lightStyle) return;
    mapAttempted = true;
    mapStarting = true;
    scene.dataset.mapState = 'loading';

    try {
      await acquireMapLibreStylesheet();
      mapCssAcquired = true;
      const api = await withTimeout(loadMapLibre(), 8_000, 'MapLibre runtime');
      if (disposed || !preloadIntersecting) {
        removeMainMap();
        return;
      }
      map = new api.Map({
        container: mapHost,
        style: isDarkTheme() ? darkStyle : lightStyle,
        center: owner,
        zoom: Number(scene.dataset.mapZoom) || 6,
        attributionControl: false,
        interactive: false,
        boxZoom: false,
        doubleClickZoom: false,
        dragPan: false,
        dragRotate: false,
        keyboard: false,
        scrollZoom: false,
        touchZoomRotate: false,
      } as unknown as import('maplibre-gl').MapOptions);
      mainStyleUrl = isDarkTheme() ? darkStyle : lightStyle;
      map.on('error', () => {
        if (!mapLoaded) useFallback();
      });
      await withTimeout(waitForMapLoad(map), 8_500, 'MapLibre style');
      if (disposed || !map) {
        removeMainMap();
        return;
      }
      mapLoaded = true;
      applyChineseMapLabels(map);
      normalMarker = createNormalMarker(api, map, owner);
      scene.dataset.mapState = 'ready';
      map.resize();
    } catch {
      useFallback();
    } finally {
      mapStarting = false;
    }
  };

  const addGlobeRoute = (api: MapLibreApi, globe: MapInstance, user: Coordinate) => {
    const shortUser: Coordinate = [shortestLongitudeFrom(owner[0], user[0]), user[1]];
    const route = {
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates: [owner, shortUser] },
    };
    const source = globe.getSource('residence-route') as import('maplibre-gl').GeoJSONSource | undefined;
    if (source) source.setData(route);
    else {
      globe.addSource('residence-route', { type: 'geojson', data: route });
      globe.addLayer({
        id: 'residence-route-line',
        type: 'line',
        source: 'residence-route',
        paint: {
          'line-color': '#9ca3af',
          'line-width': 2,
          'line-opacity': 0.75,
          'line-dasharray': [2, 2],
        },
      });
    }
    if (!globeRouteElement && globeHost) {
      globeRouteElement = document.createElement('span');
      globeRouteElement.dataset.globeRoute = '';
      globeRouteElement.hidden = true;
      globeRouteElement.setAttribute('aria-hidden', 'true');
      globeHost.append(globeRouteElement);
    }
    void api;
  };

  const renderVisitorLocation = (api: MapLibreApi, globe: MapInstance, user: Coordinate) => {
    const distance = haversineDistanceKm(owner, user);
    const fitZoom = globeFitZoomForDistance(distance);
    const padding = globeFitPaddingForDistance(distance);
    visitorCoordinates = user;
    scene.dataset.locationState = 'ready';
    scene.dataset.locationDistanceKm = distance.toFixed(2);
    if (dialog) {
      dialog.dataset.globeFitZoom = String(fitZoom);
      dialog.dataset.globeFitPadding = String(padding);
    }
    globeVisitorMarker?.remove();
    globeVisitorMarker = createAvatarMarker(api, globe, 'visitor', user, visitorAvatar, 'Visitor location');
    addGlobeRoute(api, globe, user);
    const bounds = new api.LngLatBounds(owner, owner);
    bounds.extend([shortestLongitudeFrom(owner[0], user[0]), user[1]]);
    globe.fitBounds(bounds, {
      padding,
      maxZoom: fitZoom,
      duration: reducedMotion.matches ? 0 : globeFlyDuration(globe.getZoom(), fitZoom),
    });
    const distanceLabel =
      distance >= 1000
        ? `${Math.round(distance).toLocaleString()} km away`
        : distance >= 100
          ? `${Math.round(distance)} km away`
          : `${distance.toFixed(1)} km away`;
    setGlobeStatus(`${scene.querySelector<HTMLElement>('[data-residence-label]')?.textContent ?? 'Residence'} · ${distanceLabel}`);
  };

  const cleanupGlobe = () => {
    globeGeneration += 1;
    if (closingTimer) window.clearTimeout(closingTimer);
    closingTimer = undefined;
    globeStarting = undefined;
    globeVisitorMarker?.remove();
    globeOwnerMarker?.remove();
    globeVisitorMarker = undefined;
    globeOwnerMarker = undefined;
    globeRouteElement?.remove();
    globeRouteElement = undefined;
    try {
      globeMap?.stop();
      globeMap?.remove();
    } catch {
      // Best-effort cleanup for native dialog close and Astro swaps.
    }
    globeMap = undefined;
    globeStyleUrl = '';
    if (globeCssAcquired) {
      releaseMapLibreStylesheet();
      globeCssAcquired = false;
    }
    if (dialog) dialog.dataset.globeState = 'idle';
    if (globeCanvas) globeCanvas.dataset.globeState = 'idle';
  };

  const startGlobe = () => {
    if (!dialog || !globeCanvas || !globeHost || disposed) return Promise.resolve();
    if (globeMap) {
      globeMap.resize();
      return Promise.resolve();
    }
    if (globeStarting) return globeStarting;
    const generation = globeGeneration + 1;
    globeGeneration = generation;
    setGlobeState('loading');
    globeStarting = (async () => {
      await acquireMapLibreStylesheet();
      if (disposed || generation !== globeGeneration || !dialog.open) {
        releaseMapLibreStylesheet();
        return;
      }
      globeCssAcquired = true;
      const api = await withTimeout(loadMapLibre(), 8_000, 'MapLibre runtime');
      if (disposed || generation !== globeGeneration || !dialog.open) {
        releaseMapLibreStylesheet();
        globeCssAcquired = false;
        return;
      }
      const globe = new api.Map({
        container: globeHost,
        style: isDarkTheme() ? darkStyle : lightStyle,
        center: owner,
        zoom: 1.2,
        pitch: 20,
        bearing: 0,
        interactive: true,
        dragRotate: true,
        attributionControl: false,
        scrollZoom: true,
        touchZoomRotate: true,
      } as unknown as import('maplibre-gl').MapOptions);
      globeMap = globe;
      globeStyleUrl = isDarkTheme() ? darkStyle : lightStyle;
      if (disposed || generation !== globeGeneration || !dialog.open) {
        globe.remove();
        globeMap = undefined;
        return;
      }
      globe.addControl(new api.NavigationControl({ showZoom: true, showCompass: true }), 'top-right');
      globeOwnerMarker = createAvatarMarker(api, globe, 'residence', owner, ownerAvatar, '居住地头像');
      globe.on('error', () => {
        if (dialog?.dataset.globeState === 'ready') setGlobeStatus('全球地图部分底图加载失败，仍可旋转查看');
      });
      await withTimeout(waitForMapLoad(globe), 8_500, 'Globe style');
      if (disposed || generation !== globeGeneration || !dialog.open) return;
      applyChineseMapLabels(globe);
      globe.setProjection({ type: 'globe' });
      setGlobeState('ready');
      globe.resize();
      if (visitorCoordinates) {
        renderVisitorLocation(api, globe, visitorCoordinates);
      } else {
        const targetZoom = 2.4;
        dialog.dataset.globeCameraZoom = String(targetZoom);
        globe.flyTo({
          center: owner,
          zoom: targetZoom,
          pitch: 28,
          bearing: 0,
          duration: reducedMotion.matches ? 0 : globeFlyDuration(globe.getZoom(), targetZoom),
        });
      }
    })()
      .catch(() => {
        if (generation !== globeGeneration || disposed || !dialog.open) return;
        setGlobeState('error');
        setGlobeStatus('Map unavailable');
        if (globeMap) {
          try {
            globeMap.remove();
          } catch {
            // Ignore a failed map during fallback.
          }
        }
        globeMap = undefined;
        if (globeCssAcquired) {
          releaseMapLibreStylesheet();
          globeCssAcquired = false;
        }
      })
      .finally(() => {
        globeStarting = undefined;
      });
    return globeStarting;
  };

  const openGlobe = async (autoLocate = true) => {
    if (!dialog || disposed) return;
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();
    bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.dataset.globeOpen = 'true';
    await startGlobe();
    if (!disposed && dialog.open) {
      dialog.querySelector<HTMLButtonElement>('[data-globe-close]')?.focus();
      if (autoLocate && !visitorCoordinates) void locateVisitor(false);
    }
  };

  const requestCloseGlobe = () => {
    if (!dialog) return;
    if (!dialog.open) {
      cleanupGlobe();
      return;
    }
    if (dialog.dataset.globeState === 'closing') return;
    setGlobeState('closing');
    closingTimer = window.setTimeout(() => {
      closingTimer = undefined;
      if (dialog.open) dialog.close();
    }, reducedMotion.matches ? 0 : 360);
  };

  const currentPosition = (options: PositionOptions) =>
    new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });

  const locateVisitor = async (ensureGlobe = true) => {
    scene.dataset.locationState = 'loading';
    if (!window.isSecureContext) {
      scene.dataset.locationState = 'error';
      setGlobeStatus('Location requires HTTPS');
      return;
    }
    if (!('geolocation' in navigator)) {
      scene.dataset.locationState = 'error';
      setGlobeStatus('Geolocation unsupported');
      return;
    }
    try {
      if (ensureGlobe) await openGlobe(false);
      if ('permissions' in navigator && navigator.permissions?.query) {
        geolocationPermission = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        if (geolocationPermission.state === 'denied') {
          setGlobeStatus('Permission denied');
          scene.dataset.locationState = 'error';
          return;
        }
        geolocationPermission.onchange = () => {
          if (geolocationPermission?.state === 'denied') {
            scene.dataset.locationState = 'error';
            setGlobeStatus('Permission denied');
          }
        };
      }
      setGlobeStatus('Locating...');
      let position: GeolocationPosition;
      try {
        position = await currentPosition({ enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 });
      } catch (error) {
        const code = (error as GeolocationPositionError).code;
        if (code !== 3) throw error;
        setGlobeStatus('Request timed out');
        position = await currentPosition({ enableHighAccuracy: false, maximumAge: 300_000, timeout: 30_000 });
      }
      if (disposed || !dialog?.open) return;
      if (!globeMap) throw new Error('globe-not-ready');
      const user: Coordinate = [position.coords.longitude, position.coords.latitude];
      const api = await loadMapLibre();
      renderVisitorLocation(api, globeMap, user);
    } catch (error) {
      scene.dataset.locationState = 'error';
      const code = (error as GeolocationPositionError).code;
      setGlobeStatus(code === 1 ? 'Permission denied' : code === 3 ? 'Request timed out' : 'Location unavailable');
    }
  };

  const preloadObserver = new IntersectionObserver(
    ([entry]) => {
      preloadIntersecting = Boolean(entry?.isIntersecting);
      if (!preloadIntersecting && scene.dataset.mapState === 'fallback') mapAttempted = false;
      if (preloadIntersecting && !document.hidden) void startMainMap();
    },
    { rootMargin: '240px 0px', threshold: 0 },
  );
  const flightObserver = new IntersectionObserver(
    ([entry]) => {
      visibleIntersecting = Boolean(entry?.isIntersecting && (entry.intersectionRatio ?? 0) >= 0.08);
      setFlightState();
      if (visibleIntersecting) map?.resize();
    },
    { threshold: [0, 0.08, 1] },
  );

  const onVisibilityChange = () => {
    setFlightState();
    if (!document.hidden && preloadIntersecting) void startMainMap();
  };
  const onMotionChange = () => setFlightState();
  const updateTheme = async () => {
    if (!map && !globeMap) return;
    const targetStyle = isDarkTheme() ? darkStyle : lightStyle;
    const api = await loadMapLibre();
    if (map && mapLoaded && targetStyle && targetStyle !== mainStyleUrl) {
      const camera = {
        center: map.getCenter().toArray() as [number, number],
        zoom: map.getZoom(),
        pitch: map.getPitch(),
        bearing: map.getBearing(),
      };
      mainStyleUrl = targetStyle;
      map.setStyle(targetStyle);
      map.once('style.load', () => map?.jumpTo(camera));
    }
    if (globeMap && dialog?.dataset.globeState === 'ready' && targetStyle && targetStyle !== globeStyleUrl) {
      const camera = {
        center: globeMap.getCenter().toArray() as [number, number],
        zoom: globeMap.getZoom(),
        pitch: globeMap.getPitch(),
        bearing: globeMap.getBearing(),
      };
      globeStyleUrl = targetStyle;
      globeMap.setStyle(targetStyle);
      globeMap.once('style.load', () => {
        if (!globeMap) return;
        globeMap.setProjection({ type: 'globe' });
        globeMap.jumpTo(camera);
        if (visitorCoordinates) renderVisitorLocation(api, globeMap, visitorCoordinates);
      });
    }
  };
  const themeObserver = new MutationObserver(() => void updateTheme());
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
  const onStorage = () => void updateTheme();
  window.addEventListener('storage', onStorage);
  const onDialogClose = () => {
    cleanupGlobe();
    document.body.style.overflow = bodyOverflow;
    delete document.body.dataset.globeOpen;
    previousFocus?.focus();
    previousFocus = null;
  };
  const suspend = () => {
    if (disposed || suspended) return;
    suspended = true;
    preloadIntersecting = false;
    visibleIntersecting = false;
    preloadObserver.disconnect();
    flightObserver.disconnect();
    map?.stop();
    setFlightState();
  };
  const resume = () => {
    if (disposed || !suspended) return;
    suspended = false;
    preloadObserver.observe(scene);
    flightObserver.observe(scene);
    if (map) map.resize();
    setFlightState();
  };
  const onPageHide = (event: PageTransitionEvent) => {
    if (event.persisted) suspend();
    else dispose();
  };
  const onPageShow = (event: PageTransitionEvent) => {
    if (event.persisted) resume();
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    scene.dataset.mapController = 'disposed';
    scene.dataset.flightActive = 'false';
    preloadObserver.disconnect();
    flightObserver.disconnect();
    document.removeEventListener('visibilitychange', onVisibilityChange);
    reducedMotion.removeEventListener('change', onMotionChange);
    if (geolocationPermission) geolocationPermission.onchange = null;
    geolocationPermission = undefined;
    themeObserver.disconnect();
    window.removeEventListener('storage', onStorage);
    dialog?.removeEventListener('close', onDialogClose);
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('pageshow', onPageShow);
    removeMainMap();
    if (dialog?.open) dialog.close();
    cleanupGlobe();
    document.body.style.overflow = bodyOverflow;
    delete document.body.dataset.globeOpen;
  };

  const openButton = globeTrigger ?? maximizeButton;
  if (openButton) openButton.disabled = false;
  openButton?.addEventListener('click', () => void openGlobe());
  dialog?.querySelector('[data-globe-close]')?.addEventListener('click', requestCloseGlobe);
  dialog?.addEventListener('cancel', (event) => {
    event.preventDefault();
    requestCloseGlobe();
  });
  dialog?.addEventListener('close', onDialogClose);
  for (const button of locationButtons) button.addEventListener('click', () => void locateVisitor(false));
  document.addEventListener('visibilitychange', onVisibilityChange);
  reducedMotion.addEventListener('change', onMotionChange);
  document.addEventListener('astro:before-swap', dispose, { once: true });
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);
  preloadObserver.observe(scene);
  flightObserver.observe(scene);
  setFlightState();
}

export function initializeResidenceMaps() {
  for (const scene of document.querySelectorAll<HTMLElement>('[data-residence-map]')) {
    if (scene.dataset.mapController) continue;
    scene.dataset.mapController = 'active';
    setupResidenceScene(scene);
  }
}

/** Astro only evaluates a bundled module once. Keep one global page-load hook
 * so returning to /home through ClientRouter initializes the replacement DOM
 * without retaining any old map instance. */
export function installResidenceMapClientRouterHook() {
  if (clientRouterHookInstalled) return;
  clientRouterHookInstalled = true;
  document.addEventListener('astro:page-load', initializeResidenceMaps);
}
