import { Request as AwsRequest } from "aws-sdk";
import { AsyncResult } from "./async";
import { isSome, fromNullable } from "../option";
import { Err, Ok } from "../result";
import { log } from "../log";

export const awsRes = <D, E>(req: AwsRequest<D, E>): AsyncResult<D, E> =>
	new AsyncResult(resolve =>
		req.send((awsErr: E, awsData: D) =>
			resolve(isSome(fromNullable(awsErr)) ? log("AWS Error")(Err(awsErr)) : Ok(awsData))
		)
	);
