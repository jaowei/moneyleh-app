import { docTrainerPool } from "..";
import type { DocumentToAdd } from "../lib/descriptionTagger/base-classifier";
import { appLogger } from "../lib/logger";

export const runTrainer = (
	documentsToAdd: DocumentToAdd[],
	transactionIds: number[],
	logInfo: {
		transactionsInserted: number;
		userId: string;
	},
) => {
	docTrainerPool.runTask({ documentsToAdd }, async (err) => {
		if (err) {
			appLogger(`Training failed for user ${logInfo.userId}, ${logInfo.transactionsInserted} transactions to be trained,
	            please look for json file in root, for transactions to train`);
			await Bun.write(
				`./${new Date().toISOString()}_${logInfo.userId}_failed_training.json`,
				JSON.stringify(transactionIds),
			);
		}
	});
};
