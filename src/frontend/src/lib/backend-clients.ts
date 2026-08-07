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
export type PostTransactionsReq = InferRequestType<
	typeof backendRouteClient.api.transaction.$post
>["json"];
export type TransactionSplitUI = Exclude<
	PostTransactionsReq["transactions"][0]["split"],
	undefined
>;
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
	} else if (tagDataRes.status === 404) {
		return [];
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

export const fetchTransactionSplitSummary = async (userId: string) => {
	const res = await backendRouteClient.api.transaction.split[
		":userId"
	].summary.$get({
		param: {
			userId,
		},
	});
	if (res.ok) {
		return await res.json();
	} else {
		throw await getBackendErrorResponse(res);
	}
};

export const fetchTransactionSplitTransactions = async (
	userId: string,
	offset: number,
	limit: number,
) => {
	const res = await backendRouteClient.api.transaction.split[
		":userId"
	].transactions.$get({
		param: {
			userId,
		},
		query: {
			offset: `${offset}`,
			limit: `${limit}`,
		},
	});
	if (res.ok) {
		return await res.json();
	} else {
		throw await getBackendErrorResponse(res);
	}
};
export type TransactionSplit = Awaited<
	ReturnType<typeof fetchTransactionSplitTransactions>
>["transactionsToReceive"][0];
export type SplitSummary = Awaited<
	ReturnType<typeof fetchTransactionSplitSummary>
>;
