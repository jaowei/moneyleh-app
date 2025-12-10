import type {UiRouteType} from "../../../routes/ui.ts";
import {hc, type InferRequestType, type InferResponseType} from "hono/client";
import type {AppType} from "../../../index.ts";
import {getBackendErrorResponse} from "./error.ts";

export const uiRouteClient = hc<UiRouteType>('/api/ui')
type TransactionsRes = InferResponseType<typeof uiRouteClient.fileUpload.$post>['taggedTransactions']
export type AllAccounts = InferResponseType<typeof uiRouteClient.availableInventory[':userId']['$get']>['allAccounts']
export type AllCards = InferResponseType<typeof uiRouteClient.availableInventory[':userId']['$get']>['allCards']

export const backendRouteClient = hc<AppType>('')
export type Tag = InferResponseType<typeof backendRouteClient.api.tag[":tagId"]['$get']>
export type TransactionsReq = InferRequestType<typeof backendRouteClient.api.transaction.$post>["json"]["transactions"]
export type EditableTransaction = TransactionsReq[0] & TransactionsRes[0]

export const fetchTagData = async () => {
    const tagDataRes = await backendRouteClient.api.tag.$get()
    if (tagDataRes.ok) {
        return (await tagDataRes.json()).data
    } else {
        throw await getBackendErrorResponse(tagDataRes)
    }
}