import { Future, Executor } from "../../future";
import { ResultArray } from "../array";
import { Fn } from "../../fn";
import { Result } from "../../result";
import { AsyncResult } from "../async";
import { NonEmptyArray } from "../../array";

export class AsyncResultArray<T, E> extends Future<ResultArray<T, E>> {
	public constructor(protected readonly executor: Executor<ResultArray<T, E>>) {
		super(executor);
	}

	oks(): Future<T[]> {
		return this.then(resultArray => resultArray.oks());
	}
	errs(): Future<E[]> {
		return this.then(resultArray => resultArray.errs());
	}

	group<G>(op: Fn<T, G>): AsyncResultArray<[G, NonEmptyArray<T>], E> {
		return this._then(resultArray => resultArray.group(op));
	}
	batch(size: number): AsyncResultArray<[number, NonEmptyArray<T>], E> {
		return this._then(resultArray => resultArray.batch(size));
	}

	map<U>(op: Fn<T, U>): AsyncResultArray<U, E> {
		return this._then(resultArray => resultArray.map(op));
	}
	mapAll<U>(op: Fn<T[], U[]>): AsyncResultArray<U, E> {
		return this._then(resultArray => resultArray.mapAll(op));
	}
	flatMap<U>(op: Fn<T, U[]>): AsyncResultArray<U, E> {
		return this._then(resultArray => resultArray.flatMap(op));
	}
	mapOr<U>(def: U, op: Fn<T, U>): Future<U[]> {
		return this.then(resultArray => resultArray.mapOr(def, op));
	}
	mapOrElse<U>(def: Fn<E, U>, op: Fn<T, U>): Future<U[]> {
		return this.then(resultArray => resultArray.mapOrElse(def, op));
	}
	mapErr<F>(op: Fn<E, F>): AsyncResultArray<T, F> {
		return this._then(resultArray => resultArray.mapErr(op));
	}
	flatMapErr<F>(op: Fn<E, F[]>): AsyncResultArray<T, F> {
		return this._then(resultArray => resultArray.flatMapErr(op));
	}

	and<U>(res: Result<U, E>): AsyncResultArray<U, E> {
		return this._then(resultArray => resultArray.and(res));
	}
	andThen<U>(op: Fn<T, Result<U, E>>): AsyncResultArray<U, E> {
		return this._then(resultArray => resultArray.andThen(op));
	}
	flatAndThen<U>(op: Fn<T, ResultArray<U, E>>): AsyncResultArray<U, E> {
		return this._then(resultArray => resultArray.flatAndThen(op));
	}

	or<F>(res: Result<T, F>): AsyncResultArray<T, F> {
		return this._then(resultArray => resultArray.or(res));
	}
	orElse<F>(op: Fn<E, Result<T, F>>): AsyncResultArray<T, F> {
		return this._then(resultArray => resultArray.orElse(op));
	}

	unwrapOr(def: T): Future<T[]> {
		return this.then(resultArray => resultArray.unwrapOr(def));
	}
	unwrapOrElse(op: Fn<E, T>): Future<T[]> {
		return this.then(resultArray => resultArray.unwrapOrElse(op));
	}

	unwrap(msg?: string): Future<T[]> {
		return this.then(resultArray => resultArray.unwrap(msg));
	}
	unwrapErr(msg?: string): Future<E[]> {
		return this.then(resultArray => resultArray.unwrapErr(msg));
	}

	flip(): AsyncResultArray<E, T> {
		return this._then(resultArray => resultArray.flip());
	}

	async(): this {
		return this;
	}
	mapAsync<U>(op: Fn<T, Future<U>>): AsyncResultArray<U, E> {
		return this._thenAsync(resultArray => resultArray.mapAsync(op));
	}
	flatMapAsync<U>(op: Fn<T, Future<U[]>>): AsyncResultArray<U, E> {
		return this._thenAsync(resultArray => resultArray.flatMapAsync(op));
	}
	mapErrAsync<F>(op: Fn<E, Future<F>>): AsyncResultArray<T, F> {
		return this._thenAsync(resultArray => resultArray.mapErrAsync(op));
	}
	andAsync<U>(res: AsyncResult<U, E>): AsyncResultArray<U, E> {
		return this._thenAsync(resultArray => resultArray.andAsync(res));
	}
	andThenAsync<U>(op: Fn<T, AsyncResult<U, E>>): AsyncResultArray<U, E> {
		return this._thenAsync(resultArray => resultArray.andThenAsync(op));
	}
	flatAndThenAsync<U>(op: Fn<T, AsyncResultArray<U, E>>): AsyncResultArray<U, E> {
		return this._thenAsync(resultArray => resultArray.flatAndThenAsync(op));
	}
	orAsync<F>(res: AsyncResult<T, F>): AsyncResultArray<T, F> {
		return this._thenAsync(resultArray => resultArray.orAsync(res));
	}	
	orElseAsync<F>(op: Fn<E, AsyncResult<T, F>>): AsyncResultArray<T, F> {
		return this._thenAsync(resultArray => resultArray.orElseAsync(op));
	}

	static fromFuture<T, E>(future: Future<ResultArray<T, E>>): AsyncResultArray<T, E> {
		return new AsyncResultArray(resolve => future.start(resolve));
	}
	static fromFutureArray<T, E>(future: Future<Result<T, E>[]>): AsyncResultArray<T, E> {
		return AsyncResultArray.fromFuture(future.then(ResultArray.from));
	}
	static fromAsyncArray<T, E>(results: AsyncResult<T, E>[]): AsyncResultArray<T, E> {
		return AsyncResultArray.fromFutureArray(Future.all(results));
	}
	private _then<U, F>(op: Fn<ResultArray<T, E>, ResultArray<U, F>>): AsyncResultArray<U, F> {
		return AsyncResultArray.fromFuture(this.then(op));
	}
	private _thenAsync<U, F>(op: Fn<ResultArray<T, E>, AsyncResultArray<U, F>>): AsyncResultArray<U, F> {
		return new AsyncResultArray(resolve => this.start((resultArray: ResultArray<T, E>) => op(resultArray).start(resolve)));
	}
}

export const resMapAsync = <T, U, E>(vals: T[], op: Fn<T, AsyncResult<U, E>>): AsyncResultArray<U, E> =>
	ResultArray.ok<T, E>(vals).andThenAsync(op);

export const resFlatMapAsync = <T, U, E>(vals: T[], op: Fn<T, AsyncResultArray<U, E>>): AsyncResultArray<U, E> =>
	ResultArray.ok<T, E>(vals).flatAndThenAsync(op);
