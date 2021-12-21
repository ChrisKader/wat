import { RequestInfo, RequestInit, Response } from 'node-fetch/@types';

export interface RequestInitWithRetry extends RequestInit {
	retries?: number;
	retryDelay?: number;
	retryOn?: number[];
}

function isResponseError(candidate: any): candidate is Response {
	return candidate.type === 'error';
}

export async function fetchAgain(url: RequestInfo, init?: RequestInitWithRetry): Promise<Response> {
	let retry = 1
	if (init && (init.retries && init.retries > 0)) {
		retry = init.retries
	}

	let initRequest = false
	let result = new Response(typeof (url) === 'string' ? url : null, { status: 0, statusText: 'notStarted' });

	let isError = false
	let error = new Response(typeof (url) === 'string' ? url : null, { status: 0, statusText: 'unknownError' });
	while (retry > 0) {
		try {
			result = await import('node-fetch/@types').then(({ default: fetch }) => fetch(url, init))
			initRequest = true
			return result
		} catch (e: unknown) {
			//TODO: add options for callback.
			retry = retry - 1
			if (retry === 0) {
				if (isResponseError(e)) {
					isError = true
					error = e
				}
			}

			if (init && init.retryDelay) {
				console.log(`fetchAgain pausing for ${init.retryDelay} before retrying`)
				await sleep(init.retryDelay)
			}
			console.log(`Fetching ${url} ${retry} more time(s)`)
		}
	}
	return isError ? error : result
}

function sleep(delay: number) {
	return new Promise(resolve => setTimeout(resolve, delay));
}
