// Copied and modified
// from https://nodejs.org/api/async_context.html#using-asyncresource-for-a-worker-thread-pool

import {AsyncResource} from 'node:async_hooks';
import {EventEmitter} from 'node:events';
import {Worker} from 'node:worker_threads';
import type {WorkerTaskObj} from "./classifier-trainer-worker.ts";

const kTaskInfo = Symbol('kTaskInfo');
const kWorkerFreedEvent = Symbol('kWorkerFreedEvent');

type ExtendedWorker = Worker & {
    [kTaskInfo]?: WorkerPoolTaskInfo
}

type WorkerCallback = (err: Error, res: string) => void;

class WorkerPoolTaskInfo extends AsyncResource {
    callback: WorkerCallback;

    constructor(callback: WorkerCallback) {
        super('WorkerPoolTaskInfo');
        this.callback = callback;
    }

    done(err: Error | null, result: string | null) {
        this.runInAsyncScope(this.callback, null, err, result);
        this.emitDestroy();  // `TaskInfo`s are used only once.
    }
}

export default class WorkerPool extends EventEmitter {
    numThreads: number;
    workers: ExtendedWorker[];
    freeWorkers: ExtendedWorker[];
    tasks: { task: WorkerTaskObj; callback: WorkerCallback }[];

    constructor(numThreads: number) {
        super();
        this.numThreads = numThreads;
        this.workers = [];
        this.freeWorkers = [];
        this.tasks = [];

        for (let i = 0; i < numThreads; i++)
            this.addNewWorker();

        // Any time the kWorkerFreedEvent is emitted, dispatch
        // the next task pending in the queue, if any.
        this.on(kWorkerFreedEvent, () => {
            if (this.tasks.length > 0) {
                const taskData = this.tasks.shift();
                if (!taskData) return

                this.runTask(taskData.task, taskData.callback);
            }
        });
    }

    addNewWorker() {
        const worker: ExtendedWorker = new Worker(new URL('./classifier-trainer-worker.ts', import.meta.url))
        worker.on('message', (result) => {
            // In case of success: Call the callback that was passed to `runTask`,
            // remove the `TaskInfo` associated with the Worker, and mark it as free
            // again.
            if (worker[kTaskInfo]) {
                worker[kTaskInfo].done(null, result);
                worker[kTaskInfo] = undefined;
                this.freeWorkers.push(worker);
                this.emit(kWorkerFreedEvent);
            }
        });
        worker.on('error', (err) => {
            // In case of an uncaught exception: Call the callback that was passed to
            // `runTask` with the error.
            if (worker[kTaskInfo]) {
                worker[kTaskInfo].done(err, null);
            } else {
                this.emit('error', err);
            }
            // Remove the worker from the list and start a new Worker to replace the
            // current one.
            this.workers.splice(this.workers.indexOf(worker), 1);
            this.addNewWorker();
        });
        this.workers.push(worker);
        this.freeWorkers.push(worker);
        this.emit(kWorkerFreedEvent);
    }

    runTask(task: WorkerTaskObj, callback: WorkerCallback) {
        if (this.freeWorkers.length === 0) {
            // No free threads, wait until a worker thread becomes free.
            this.tasks.push({task, callback});
            return;
        }

        const worker = this.freeWorkers.pop();

        if (!worker) return

        worker[kTaskInfo] = new WorkerPoolTaskInfo(callback);
        worker.postMessage(task);
    }

    close() {
        for (const worker of this.workers) worker.terminate();
    }
}