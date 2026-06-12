// https://bun.com/docs/runtime/environment-variables, interface merging to type env vars

declare module "bun" {
	interface Env {
		NUM_CLASSIFIER_WORKERS: number;
	}
}
