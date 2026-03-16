declare module 'kuzu' {
  export class Database {
    constructor(path: string);
  }
  export class Connection {
    constructor(db: Database);
    query(cypher: string): Promise<QueryResult>;
  }
  export interface QueryResult {
    getAll(): Promise<unknown[]>;
  }
}
