import type {UiRouteType} from "../../../routes/ui.ts";
import {hc, type InferRequestType, type InferResponseType} from "hono/client";
import type {AppType} from "../../../index.ts";

export const uiRouteClient = hc<UiRouteType>('/api/ui')
type TransactionsRes = InferResponseType<typeof uiRouteClient.fileUpload.$post>['taggedTransactions']
export type AllAccounts = InferResponseType<typeof uiRouteClient.availableInventory[':userId']['$get']>['allAccounts']
export type AllCards = InferResponseType<typeof uiRouteClient.availableInventory[':userId']['$get']>['allCards']

export const backendRouteClient = hc<AppType>('')
export type Tag = InferResponseType<typeof backendRouteClient.api.tag[":tagId"]['$get']>
export type TransactionsReq = InferRequestType<typeof backendRouteClient.api.transaction.$post>["json"]["transactions"]
export type Transaction = TransactionsReq[0] & TransactionsRes[0]