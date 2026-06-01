export type TransactionCallback<T> = (tx: any) => T | Promise<T>;

export interface DatabaseAdapter {
  db: any;
  initialize(): Promise<void>;
  close(): Promise<void>;
  transaction<T>(callback: TransactionCallback<T>): Promise<T>;
}
