type QueryFilter = {
  field: string;
  op: "eq" | "in" | "is" | "lt";
  value: unknown;
};

export type QueryState = {
  table: string;
  action: "select" | "insert" | "update" | "delete";
  payload?: unknown;
  selectClause?: string;
  selectOptions?: Record<string, unknown>;
  filters: QueryFilter[];
  orderBy?: {
    field: string;
    ascending: boolean;
  };
  limit?: number;
};

export type QueryResult<T = unknown> = {
  count?: number | null;
  data?: T | null;
  error?: { message: string } | null;
};

type QueryHandler = (
  state: QueryState,
) => QueryResult | Promise<QueryResult>;

type AuthHandlers = {
  getUser?: (accessToken: string) => Promise<unknown>;
  getUserById?: (userId: string) => Promise<unknown>;
  listUsers?: (params: { page: number; perPage: number }) => Promise<unknown>;
  generateLink?: (params: unknown) => Promise<unknown>;
  updateUserById?: (userId: string, payload: unknown) => Promise<unknown>;
};

type StorageHandlers = {
  list?: (path: string, options?: unknown) => Promise<unknown>;
  remove?: (paths: string[]) => Promise<unknown>;
};

type FakeSupabaseOptions = {
  auth?: AuthHandlers;
  onQuery: QueryHandler;
  storage?: StorageHandlers;
};

class FakeQueryBuilder implements PromiseLike<QueryResult> {
  private readonly state: QueryState;

  constructor(
    table: string,
    private readonly onQuery: QueryHandler,
  ) {
    this.state = {
      table,
      action: "select",
      filters: [],
    };
  }

  select(
    selectClause: string,
    selectOptions?: Record<string, unknown>,
  ): this {
    this.state.selectClause = selectClause;
    this.state.selectOptions = selectOptions;
    return this;
  }

  insert(payload: unknown): this {
    this.state.action = "insert";
    this.state.payload = payload;
    return this;
  }

  update(payload: unknown): this {
    this.state.action = "update";
    this.state.payload = payload;
    return this;
  }

  delete(): this {
    this.state.action = "delete";
    return this;
  }

  eq(field: string, value: unknown): this {
    this.state.filters.push({ field, op: "eq", value });
    return this;
  }

  in(field: string, value: unknown): this {
    this.state.filters.push({ field, op: "in", value });
    return this;
  }

  is(field: string, value: unknown): this {
    this.state.filters.push({ field, op: "is", value });
    return this;
  }

  lt(field: string, value: unknown): this {
    this.state.filters.push({ field, op: "lt", value });
    return this;
  }

  order(field: string, options?: { ascending?: boolean }): this {
    this.state.orderBy = {
      field,
      ascending: options?.ascending !== false,
    };
    return this;
  }

  limit(value: number): this {
    this.state.limit = value;
    return this;
  }

  returns<T>(): Promise<QueryResult<T>> {
    return this.execute<T>();
  }

  single<T>(): Promise<QueryResult<T>> {
    return this.execute<T>();
  }

  maybeSingle<T>(): Promise<QueryResult<T>> {
    return this.execute<T>();
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?:
      | ((value: QueryResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?:
      | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
      | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute<T = unknown>(): Promise<QueryResult<T>> {
    const result = await this.onQuery({
      ...this.state,
      filters: [...this.state.filters],
    });

    return {
      count: result.count ?? null,
      data: (result.data ?? null) as T | null,
      error: result.error ?? null,
    };
  }
}

export function createSupabaseMock(options: FakeSupabaseOptions) {
  return {
    auth: {
      getUser: async (accessToken: string) => {
        if (!options.auth?.getUser) {
          return {
            data: { user: null },
            error: null,
          };
        }

        return options.auth.getUser(accessToken);
      },
      admin: {
        getUserById: async (userId: string) => {
          if (!options.auth?.getUserById) {
            return {
              data: { user: null },
              error: null,
            };
          }

          return options.auth.getUserById(userId);
        },
        listUsers: async (params: { page: number; perPage: number }) => {
          if (!options.auth?.listUsers) {
            return {
              data: { users: [], lastPage: 1 },
              error: null,
            };
          }

          return options.auth.listUsers(params);
        },
        generateLink: async (params: unknown) => {
          if (!options.auth?.generateLink) {
            return {
              data: null,
              error: { message: "generateLink handler not configured" },
            };
          }

          return options.auth.generateLink(params);
        },
        updateUserById: async (userId: string, payload: unknown) => {
          if (!options.auth?.updateUserById) {
            return {
              data: null,
              error: null,
            };
          }

          return options.auth.updateUserById(userId, payload);
        },
      },
    },
    from(table: string) {
      return new FakeQueryBuilder(table, options.onQuery);
    },
    storage: {
      from() {
        return {
          list: async (path: string, listOptions?: unknown) => {
            if (!options.storage?.list) {
              return {
                data: [],
                error: null,
              };
            }

            return options.storage.list(path, listOptions);
          },
          remove: async (paths: string[]) => {
            if (!options.storage?.remove) {
              return {
                data: [],
                error: null,
              };
            }

            return options.storage.remove(paths);
          },
        };
      },
    },
  };
}
