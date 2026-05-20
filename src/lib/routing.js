import { useEffect } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";

// ── OverAI global shims ──────────────────────────────────────
// These replace OverAI's useSearchParam and setSearchParam globals.
// "page" routing now uses real URL paths (/products, /contact, etc.);
// sub-page params (productId, family, etc.) stay as search params.

export function pathnameToPage(pathname) {
  const seg = pathname.replace(/^\//, "").split("/")[0];
  return seg || null; // null → home
}

export function pageToPath(pageVal) {
  if (!pageVal || pageVal === "home") return "/";
  return `/${pageVal}`;
}

/**
 * Shim for OverAI's useSearchParam.
 * "page" key reads from URL pathname; all other keys read from the search string.
 */
export function useSearchParam(key) {
  const location = useLocation();
  const [searchParams, setSearchParamsFn] = useSearchParams();

  if (key === "page") {
    const page = pathnameToPage(location.pathname);
    const setter = (val) => {
      const path = pageToPath(val);
      if (_navigateRef) _navigateRef(path);
      else window.history.pushState({}, "", path);
    };
    return [page, setter];
  }

  const value = searchParams.get(key) || null;
  const setter = (val) => {
    setSearchParamsFn(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (val === null || val === undefined || val === "") next.delete(key);
        else next.set(key, String(val));
        return next;
      },
      { replace: false },
    );
  };
  return [value, setter];
}

// Module-level refs wired up by useSetSearchParamRef() inside <App />.
let _setSearchParamsRef = null;
let _navigateRef = null;

export function useSetSearchParamRef() {
  const [, setSearchParamsFn] = useSearchParams();
  const navigate = useNavigate();
  useEffect(() => {
    _navigateRef = navigate;
    _setSearchParamsRef = (updates) => {
      const { page: pageVal, ...rest } = updates;
      if (pageVal !== undefined) {
        // Navigate to the new page path, carrying any extra params in the search string.
        const path = pageToPath(pageVal);
        const nonEmpty = Object.fromEntries(
          Object.entries(rest).filter(([, v]) => v !== null && v !== undefined && v !== "")
        );
        const qs = new URLSearchParams(nonEmpty).toString();
        navigate(path + (qs ? `?${qs}` : ""), { replace: false });
      } else {
        setSearchParamsFn(
          (prev) => {
            const next = new URLSearchParams(prev);
            for (const [k, v] of Object.entries(rest)) {
              if (v === null || v === undefined || v === "") next.delete(k);
              else next.set(k, String(v));
            }
            return next;
          },
          { replace: false },
        );
      }
    };
    return () => {
      _setSearchParamsRef = null;
      _navigateRef = null;
    };
  }, [setSearchParamsFn, navigate]);
}

export function setSearchParam(key, val) {
  if (key === "page") {
    const path = pageToPath(val);
    if (_navigateRef) _navigateRef(path);
    else window.history.pushState({}, "", path);
    return;
  }
  if (_setSearchParamsRef) {
    _setSearchParamsRef({ [key]: val });
  } else {
    const url = new URL(window.location.href);
    if (val === null || val === undefined || val === "")
      url.searchParams.delete(key);
    else url.searchParams.set(key, String(val));
    window.history.pushState({}, "", url.toString());
  }
}

// Batch updater — apply multiple param changes in a single navigation.
export function setSearchParams(updates) {
  if (_setSearchParamsRef) {
    _setSearchParamsRef(updates);
  } else {
    const { page: pageVal, ...rest } = updates;
    const url = new URL(window.location.href);
    if (pageVal !== undefined) {
      const newUrl = new URL(pageToPath(pageVal), window.location.origin);
      for (const [k, v] of Object.entries(rest)) {
        if (v !== null && v !== undefined && v !== "") newUrl.searchParams.set(k, String(v));
      }
      window.history.pushState({}, "", newUrl.toString());
    } else {
      for (const [k, v] of Object.entries(rest)) {
        if (v === null || v === undefined || v === "") url.searchParams.delete(k);
        else url.searchParams.set(k, String(v));
      }
      window.history.pushState({}, "", url.toString());
    }
  }
}

// ── End of OverAI global shims ───────────────────────────────
