import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Schema, model } from "mongoose";
import QueryBuilder from "../src/builder/queryBuilder";
import { connectTestDB, disconnectTestDB } from "./helpers/db";

interface IItem {
  name: string;
  category: string;
  secret: string;
}

const Item = model<IItem>(
  "Item",
  new Schema<IItem>({
    name: String,
    category: String,
    secret: String,
  }),
);

beforeAll(async () => {
  await connectTestDB();

  const docs = Array.from({ length: 15 }, (_, i) => ({
    name: `item-${i}`,
    category: i % 2 === 0 ? "even" : "odd",
    secret: `secret-${i}`,
  }));
  docs.push({ name: "special (item)", category: "even", secret: "s" });
  await Item.insertMany(docs);
});

afterAll(async () => {
  await disconnectTestDB();
});

describe("QueryBuilder.filter", () => {
  it("filters by plain string values", async () => {
    const qb = new QueryBuilder(Item.find(), { category: "even" }).filter();
    const result = await qb.modelQuery;
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((doc) => doc.category === "even")).toBe(true);
  });

  it("strips NoSQL operator injection objects", async () => {
    // With the extended query parser, ?category[$ne]=even arrives like this
    const malicious = { category: { $ne: "even" } };
    const qb = new QueryBuilder(
      Item.find(),
      malicious as unknown as Record<string, string>,
    ).filter();
    const result = await qb.modelQuery;

    // The injected operator must be dropped: the query returns ALL docs
    // instead of applying the attacker's filter
    const total = await Item.countDocuments();
    expect(result.length).toBe(total);
  });

  it("drops keys containing $ or dots", async () => {
    const qb = new QueryBuilder(Item.find(), {
      $where: "true",
      "a.b": "c",
    } as unknown as Record<string, string>).filter();
    const result = await qb.modelQuery;
    expect(result.length).toBe(await Item.countDocuments());
  });
});

describe("QueryBuilder.search", () => {
  it("matches case-insensitively on searchable fields", async () => {
    const qb = new QueryBuilder(Item.find(), { searchTerm: "ITEM-1" }).search([
      "name",
    ]);
    const result = await qb.modelQuery;
    expect(result.length).toBeGreaterThan(0);
  });

  it("escapes regex metacharacters instead of interpreting them", async () => {
    // "(item)" would be a regex group if unescaped; escaped it only
    // matches the literal text
    const qb = new QueryBuilder(Item.find(), { searchTerm: "(item)" }).search([
      "name",
    ]);
    const result = await qb.modelQuery;
    expect(result.length).toBe(1);
    expect(result[0].name).toBe("special (item)");
  });

  it("does not throw on invalid regex input", async () => {
    const qb = new QueryBuilder(Item.find(), { searchTerm: "a[" }).search([
      "name",
    ]);
    await expect(qb.modelQuery).resolves.toEqual([]);
  });
});

describe("QueryBuilder.paginate + countTotal", () => {
  it("returns correct pagination metadata", async () => {
    const qb = new QueryBuilder(Item.find(), { page: "2", limit: "10" })
      .filter()
      .paginate();

    const [meta, result] = await Promise.all([qb.countTotal(), qb.modelQuery]);

    expect(meta.page).toBe(2);
    expect(meta.limit).toBe(10);
    expect(meta.total).toBe(16);
    expect(meta.totalPage).toBe(2);
    expect(result.length).toBe(6);
  });
});
