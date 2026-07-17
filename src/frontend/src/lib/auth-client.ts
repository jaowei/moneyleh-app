import { adminClient, magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { ac, adminRole, userRole } from "../../../lib/permissions";

export const authClient = createAuthClient({
	plugins: [
		magicLinkClient(),
		adminClient({
			ac,
			roles: {
				user: userRole,
				admin: adminRole,
			},
		}),
	],
});

export const fetchAllUsers = async (currentUserId: string) => {
	const res = await authClient.admin.listUsers({ query: {} });
	if (res.error) {
		return res;
	}

	const filtered = res.data.users.filter((user) => user.id !== currentUserId);
	return {
		...res,
		data: {
			...res.data,
			users: filtered,
		},
	};
};
export type UsersResponse = NonNullable<
	Awaited<ReturnType<typeof fetchAllUsers>>["data"]
>;
