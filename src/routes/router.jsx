import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const RouterContext = createContext({ location: window.location, navigate: () => {} });

const normalizePath = (path) => path || '/';

const matchesPath = (routePath, pathname) => {
  if (routePath === '*') return true;
  if (routePath?.endsWith('/*')) {
    const base = routePath.slice(0, -2);
    return pathname === base || pathname.startsWith(`${base}/`);
  }
  return normalizePath(routePath) === pathname;
};

export function BrowserRouter({ children }) {
  const [locationState, setLocationState] = useState(() => ({
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
    state: window.history.state?.usr,
  }));

  useEffect(() => {
    const syncLocation = () => setLocationState({
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
      state: window.history.state?.usr,
    });

    window.addEventListener('popstate', syncLocation);
    return () => window.removeEventListener('popstate', syncLocation);
  }, []);

  const value = useMemo(() => ({
    location: locationState,
    navigate: (to, { replace = false, state } = {}) => {
      const target = typeof to === 'string' ? to : to?.pathname || '/';
      const method = replace ? 'replaceState' : 'pushState';
      window.history[method]({ usr: state }, '', target);
      setLocationState({
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
        state,
      });
    },
  }), [locationState]);

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useLocation() {
  return useContext(RouterContext).location;
}

export function Navigate({ to, replace = false, state }) {
  const { navigate } = useContext(RouterContext);

  useEffect(() => {
    navigate(to, { replace, state });
  }, [navigate, replace, state, to]);

  return null;
}

export function Route() {
  return null;
}

export function Routes({ children }) {
  const { location } = useContext(RouterContext);
  const routes = React.Children.toArray(children);
  const match = routes.find((route) => matchesPath(route.props.path, location.pathname));
  return match?.props?.element || null;
}

export function Outlet() {
  return null;
}
