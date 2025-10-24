/*
Copyright 2024 Suredesigns Corp.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/


/**
 * @typedef TaskInfo
 * An object representing information about the task added into
 * a TaskQueue.
 * 
 * @property {() => void} task
 * The target task.
 * 
 * @property {DOMHighResTimeStamp} timestamp
 * Timestamp of when the target task is added.
 * 
 * @property {number} priority
 * Priority of the target task.
 */


/**
 * Creates a `TaskInfo`.
 * 
 * @param {() => void} task 
 * @param {number} priority 
 * @returns {TaskInfo}
 */
const TaskInfo = (task, priority) => {
    if (typeof task !== "function") {
        throw new TypeError("'task' is not a function");
    }
    if (typeof priority !== "number" || Number.isNaN(priority)) {
        throw new TypeError("'priority' is not a number");
    }
    const priority_ = Math.trunc(
        Math.max(TaskQueue.Priority.IDLE,
            Math.min(TaskQueue.Priority.IMMEDIATE, priority)
        )
    );
    const timestamp = performance.now();

    return {
        task,
        timestamp,
        priority: priority_
    };
};

class TaskQueue {
    /**
     * Predefined priorities.
     */
    static Priority = {
        IMMEDIATE: 100,
        NORMAL   : 50,
        IDLE     : 0,
    };

    /**
     * 
     * @param {object} options 
     * @param {number} options.windowTimeWeight
     * @param {number} options.residenceTimeThresholdInMilliseconds
     */
    constructor(options) {
        const window_time_weight = typeof options?.windowTimeWeight === "number" ?
            options.windowTimeWeight :
            0.8
        ;
        const residence_time_threshold_ms = typeof options?.residenceTimeThresholdInMilliseconds === "number" ?
            options.residenceTimeThresholdInMilliseconds :
            100
        ;

        this.#windowTimeWeight = window_time_weight;
        this.#residenceTimeThresholdInMilliseconds = residence_time_threshold_ms;
    }

    /**
     * Add a task with the given priority.
     * 
     * @param {() => void} task 
     * A task to add.
     * 
     * @param {number} priority 
     * A number representing the task's priority.
     * 
     * @returns {TaskInfo}
     */
    add(task, priority) {
        const task_info = TaskInfo(task, priority);
        const priority_ = task_info.priority;

        const tasks = this.#tasks;
        const index = tasks.findLastIndex(task => (priority_ < task.priority));

        tasks.splice(index + 1, 0, task_info);

        this.#run();

        return task_info;
    }

    /**
     * Remove a task from the target queue.
     * 
     * @param {TaskInfo} taskInfo 
     * An object associated with the task to remove.
     */
    remove(taskInfo) {
        const task_info = taskInfo;
    
        if (task_info === null || typeof task_info !== "object") {
            return;
        }

        const tasks = this.#tasks;
        const index = tasks.indexOf(task_info);
        if (index >= 0) {
            tasks.splice(index, 1);
        }
    }

    #update(timestamp) {
        const residence_time_threshold_ms = this.#residenceTimeThresholdInMilliseconds;
        setTimeout(() => {
            const tasks = this.#tasks;

            for (const task of tasks) {
                if (timestamp - task.timestamp >= residence_time_threshold_ms) {
                    const priority = task.priority;
                    task.priority = Math.min(
                        priority + TaskQueue.Priority.NORMAL,
                        TaskQueue.Priority.IMMEDIATE
                    );
                }
            }

            tasks.sort((x, y) => {
                const order = (x.priority - y.priority);
                //  i < j ==>    tasks[i].priority  <= tasks[j].priority
                //            && tasks[i].timestamp >= tasks[j].timestamp
                return order + (!order) * (y.timestamp - x.timestamp);
            });
        }, 0);
    }

    #run() {
        if (this.#is_running) { return; }

        const tasks = this.#tasks;
        if (tasks.length <= 0) {
            return;
        }

        let last_timestamp = 0;

        const window_time_weight = this.#windowTimeWeight;

        /**
         * @param {DOMHighResTimeStamp} timestamp 
         */
        const raf_callback = (timestamp) => {
            //  raw frame duration in microseconds
            const duration = last_timestamp > 0 ?
                (timestamp - last_timestamp) * 1000 :
                this.#estimatedFrameDurationInMicroseconds
            ;
            this.#estimatedFrameDurationInMicroseconds = Math.round(
                (this.#estimatedFrameDurationInMicroseconds * 8 + duration * 2) / 10
            );

            last_timestamp = timestamp;

            const time_window_ms = Math.round(
                window_time_weight * this.#estimatedFrameDurationInMicroseconds / 1000
            );

            while (tasks.length > 0) {
                const task = tasks.pop()?.task;

                task?.();

                const current = performance.now();
                const elapsed_ms = current - timestamp;
                if (elapsed_ms > time_window_ms) {
                    break;
                }
            }

            if (tasks.length > 0) {
                this.#update(performance.now());
                requestAnimationFrame(raf_callback);
            } else {
                this.#is_running = false;
            }
        };

        requestAnimationFrame(raf_callback);
        this.#is_running = true;
    }

    #estimatedFrameDurationInMicroseconds = 16_667; // 1_000_000 / 60 microseconds

    #is_running = false;

    /**
     * @type {TaskInfo[]}
     */
    #tasks = [];
    #windowTimeWeight;
    #residenceTimeThresholdInMilliseconds;

}

export { TaskQueue };
