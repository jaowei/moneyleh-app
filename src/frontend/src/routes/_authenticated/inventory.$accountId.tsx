import {createFileRoute} from "@tanstack/react-router";
import {backendRouteClient} from "../../lib/backend-clients.ts";
import {getBackendErrorResponse} from "../../lib/error.ts";

export const Route = createFileRoute('/_authenticated/inventory/$accountId')({
    loader: async ({context}) => {
        const {auth} = context
        if (!auth?.user?.id) {
            return
        }
        const res = await backendRouteClient.api.transaction[':userId']['$get']({
            param: {userId: auth.user.id}
        })
        if (res.ok) {
            return {
                accountTransactions: await res.json()
            }
        } else {
            throw await getBackendErrorResponse(res)
        }
    }
})