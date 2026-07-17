import { createAccessControl } from "better-auth/plugins/access";
import {
	adminAc,
	defaultStatements,
	userAc,
} from "better-auth/plugins/admin/access";

export const ac = createAccessControl(defaultStatements);

export const userRole = ac.newRole({
	...userAc.statements,
	user: ["list", "get"],
});

export const adminRole = ac.newRole({
	...adminAc.statements,
});
