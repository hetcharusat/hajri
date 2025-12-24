import { DataProvider } from "@refinedev/core";
import { supabase } from "./supabase";

/**
 * Simple Supabase Data Provider for Refine
 * Handles CRUD operations for all resources
 */
export const supabaseDataProvider: DataProvider = {
  getList: async ({ resource, pagination, filters, sorters, meta }) => {
    if (!supabase) {
      throw new Error("Supabase client is not initialized");
    }

    const { current = 1, pageSize = 10, mode = "server" } = pagination ?? {};

    let query = supabase.from(resource).select("*", { count: "exact" });

    // Apply filters
    if (filters) {
      filters.forEach((filter) => {
        if ("field" in filter) {
          const { field, operator, value } = filter;
          switch (operator) {
            case "eq":
              query = query.eq(field, value);
              break;
            case "ne":
              query = query.neq(field, value);
              break;
            case "contains":
              query = query.ilike(field, `%${value}%`);
              break;
            case "gte":
              query = query.gte(field, value);
              break;
            case "lte":
              query = query.lte(field, value);
              break;
          }
        }
      });
    }

    // Apply sorting
    if (sorters && sorters.length > 0) {
      sorters.forEach((sorter) => {
        query = query.order(sorter.field, {
          ascending: sorter.order === "asc",
        });
      });
    }

    // Apply pagination
    if (mode === "server") {
      const from = (current - 1) * pageSize;
      const to = current * pageSize - 1;
      query = query.range(from, to);
    }

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    return {
      data: data || [],
      total: count || 0,
    };
  },

  getOne: async ({ resource, id, meta }) => {
    if (!supabase) throw new Error("Supabase client not initialized");
    let query = supabase.from(resource).select(meta?.select || "*").eq("id", id).single();

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return {
      data: data as any,
    };
  },

  create: async ({ resource, variables }) => {
    if (!supabase) throw new Error("Supabase client not initialized");
    const { data, error } = await supabase
      .from(resource)
      .insert(variables)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return {
      data,
    };
  },

  update: async ({ resource, id, variables }) => {
    if (!supabase) throw new Error("Supabase client not initialized");
    const { data, error } = await supabase
      .from(resource)
      .update(variables)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return {
      data,
    };
  },

  deleteOne: async ({ resource, id }) => {
    if (!supabase) throw new Error("Supabase client not initialized");
    const { data, error } = await supabase
      .from(resource)
      .delete()
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return {
      data,
    };
  },

  getApiUrl: () => {
    return "";
  },
};

export default supabaseDataProvider;
