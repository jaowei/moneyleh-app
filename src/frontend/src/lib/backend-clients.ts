import { hc, type InferRequestType, type InferResponseType } from "hono/client";
import type { AppType } from "../../../index.ts";
import type { UiRouteType } from "../../../routes/ui.ts";
import { getBackendErrorResponse } from "./error.ts";

// UI
export const uiRouteClient = hc<UiRouteType>("/api/ui");
export type FileUploadRes = InferResponseType<
	typeof uiRouteClient.fileUpload.$post
>;
export type AvailableInventoryResponse = InferResponseType<
	(typeof uiRouteClient.availableInventory)[":userId"]["$get"]
>;
export type AllAccounts = InferResponseType<
	(typeof uiRouteClient.availableInventory)[":userId"]["$get"]
>["allAccounts"];
export type AllCards = InferResponseType<
	(typeof uiRouteClient.availableInventory)[":userId"]["$get"]
>["allCards"];

// REST API
export const backendRouteClient = hc<AppType>("");
export type Tag = InferResponseType<
	(typeof backendRouteClient.api.tag)[":tagId"]["$get"]
>;
export type TransactionsReq = InferRequestType<
	typeof backendRouteClient.api.transaction.$post
>["json"]["transactions"];
export type GetTransactionDataRes = InferResponseType<
	(typeof backendRouteClient.api.transaction)[":userId"]["$get"]
>;

export type GetCompanyRes = InferResponseType<
	typeof backendRouteClient.api.company.$get
>;

export type PostAccountReq = InferRequestType<
	(typeof backendRouteClient.api.account)[":userId"]["$post"]
>["json"];
export type PostAccountRes = InferResponseType<
	(typeof backendRouteClient.api.account)[":userId"]["$post"]
>;

export type PostCardReq = InferRequestType<
	(typeof backendRouteClient.api.card)[":userId"]["$post"]
>["json"];
export type PostCardRes = InferResponseType<
	(typeof backendRouteClient.api.card)[":userId"]["$post"]
>;

export const fetchTagData = async () => {
	const tagDataRes = await backendRouteClient.api.tag.$get();
	if (tagDataRes.ok) {
		return (await tagDataRes.json()).data;
	} else {
		throw await getBackendErrorResponse(tagDataRes);
	}
};

export const fetchCompanies = async () => {
	const companyRes = await backendRouteClient.api.company.$get();
	if (companyRes.ok) {
		return (await companyRes.json()).data;
	} else {
		throw await getBackendErrorResponse(companyRes);
	}
};
