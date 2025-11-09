import type {UiRouteType} from "../../../routes/ui.ts";
import {hc} from "hono/client";

export const uiRouteClient = hc<UiRouteType>('/api/ui')