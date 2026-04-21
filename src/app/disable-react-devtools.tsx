"use client";

import { useEffect } from "react";
import DisableDevtool from "disable-devtool";

export default function DisableReactDevToolsInProduction() {
    useEffect(() => {
        if (process.env.NODE_ENV !== "production") return;

        DisableDevtool({
            disableMenu: true,
            clearLog: true,
        });
    }, []);

    return null;
}