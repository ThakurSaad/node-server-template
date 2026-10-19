import { Model, Query } from "mongoose";

// This describes the shape of the query parameters coming from the URL
// (e.g. ?searchTerm=john&sort=name&page=2&limit=10&fields=name,email)
// All fields are optional because the user may or may not include them
export interface QueryParams {
  searchTerm?: string;
  sort?: string;
  limit?: string;
  page?: string;
  fields?: string;
  [key: string]: string | undefined; // allows extra filter fields like ?age=25
}

// This describes what countTotal() returns
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPage: number;
}

// T is a generic — it represents the Mongoose document type (e.g. IUser, IProduct)
// Think of it as a placeholder for "whatever document type you're querying"
class QueryBuilder<T> {
  // modelQuery holds the Mongoose query object (e.g. User.find())
  modelQuery: Query<T[], T>;

  // query holds the parsed URL query parameters (e.g. req.query)
  query: QueryParams;
  constructor(modelQuery: Query<any[], T>, query: QueryParams) {
    this.modelQuery = modelQuery;
    this.query = query;
  }

  // searchableFields is an array of field names to search in (e.g. ["name", "email"])
  search(searchableFields: string[]): this {
    const searchTerm = this.query?.searchTerm;

    if (searchTerm && typeof searchTerm === "string") {
      // Escape regex metacharacters so user input can't inject regex
      // patterns (ReDoS) into the $regex query
      const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      this.modelQuery = this.modelQuery
        .find({
          $or: searchableFields.map((field) => ({
            [field]: { $regex: escapedTerm, $options: "i" },
          })),
        })
        .collation({ locale: "en", strength: 2 });
    }

    return this;
  }

  filter(): this {
    // Spread the query object so we don't mutate the original
    const queryObj: Record<string, unknown> = { ...this.query };

    // Remove fields that are not actual database filters
    const excludeFields = ["searchTerm", "sort", "limit", "page", "fields"];
    excludeFields.forEach((el) => delete queryObj[el]);

    // Only allow plain string values on safe keys. Nested objects/arrays are
    // dropped entirely — with the extended query parser, ?age[$ne]=0 arrives
    // as { age: { $ne: "0" } }, i.e. a NoSQL operator injection.
    const sanitized: Record<string, string> = {};
    for (const [key, value] of Object.entries(queryObj)) {
      if (key.startsWith("$") || key.includes(".")) continue;
      if (typeof value === "string") sanitized[key] = value;
    }

    this.modelQuery = this.modelQuery.find(sanitized);

    return this;
  }

  sort(): this {
    // Convert comma-separated sort string to space-separated (Mongoose format)
    // Default to newest first if no sort is provided
    const sort = (this.query?.sort || "").split(",").join(" ") || "-createdAt";

    this.modelQuery = this.modelQuery.sort(sort);

    return this;
  }

  paginate(): this {
    const page = Number(this.query?.page) || 1;
    const limit = Number(this.query?.limit) || 10;
    const skip = (page - 1) * limit;

    this.modelQuery = this.modelQuery.skip(skip).limit(limit);

    return this;
  }

  fields(): this {
    // Convert comma-separated field list to space-separated (Mongoose format)
    // Default to excluding __v if no fields are specified
    const fields = (this.query?.fields || "").split(",").join(" ") || "-__v";

    this.modelQuery = this.modelQuery.select(fields) as unknown as Query<
      T[],
      T
    >;

    return this;
  }

  async countTotal(): Promise<PaginationMeta> {
    const totalQueries = this.modelQuery.getFilter();

    // Access the underlying Mongoose model to run a count query
    const total = await (this.modelQuery.model as Model<T>).countDocuments(
      totalQueries,
    );

    const page = Number(this.query?.page) || 1;
    const limit = Number(this.query?.limit) || 10;
    const totalPage = Math.ceil(total / limit);

    return {
      page,
      limit,
      total,
      totalPage,
    };
  }
}

export default QueryBuilder;
