"use client";

import { useEffect } from "react";

type ReactDevToolsHook = {
    isDisabled?: boolean;
    inject?: (...args: unknown[]) => void;
    onCommitFiberRoot?: (...args: unknown[]) => void;
    onCommitFiberUnmount?: (...args: unknown[]) => void;
    [key: string]: unknown;
};

declare global {
    interface Window {
        __REACT_DEVTOOLS_GLOBAL_HOOK__?: ReactDevToolsHook;
    }
}

const noop = () => {};

export default function DisableReactDevToolsInProduction() {
    useEffect(() => {
        if (process.env.NODE_ENV !== "production") return;

        const existingHook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
        if (existingHook) {
            existingHook.isDisabled = true;
            existingHook.inject = noop;
            existingHook.onCommitFiberRoot = noop;
            existingHook.onCommitFiberUnmount = noop;
        }

        Object.defineProperty(window, "__REACT_DEVTOOLS_GLOBAL_HOOK__", {
            configurable: false,
            enumerable: false,
            writable: false,
            value: {
                isDisabled: true,
                inject: noop,
                onCommitFiberRoot: noop,
                onCommitFiberUnmount: noop,
                supportsFiber: true,
            } satisfies ReactDevToolsHook,
        });
    }, []);

    return null;
}