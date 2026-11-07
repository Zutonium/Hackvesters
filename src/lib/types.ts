export type MonthPoint = {
  month: string;
  sales: number;
  expenses: number;
  profit: number;
  margin: number;
};

export type WasteCategory = { prep: number; wasted: number; cost: number; pct: number };

export type Store = {
  store_id: string;
  store_name: string;
  city: string;
  format: string;
  location_type: string;
  opened_date: string;
  sqft: number;
  seats: number;
  rent_gbp_month: number;
  store_manager: string;
  refit_year: string;
  status: string;
  status_color: string;
  status_summary: string;
  ai_diagnostic: {
    headline: string;
    why_underperforming: string;
    actionable_recommendations: string[];
  };
  sales: { instore: number; app: number; delivery: number; total: number };
  orders: { instore: number; app: number; delivery: number; total: number };
  costs: {
    labour: number;
    rent: number;
    rates: number;
    utilities: number;
    repairs: number;
    other_opex: number;
    fixed_total: number;
    cogs_ingredients: number;
    delivery_commission: number;
    delivery_packaging: number;
    delivery_total: number;
    total_expenses: number;
  };
  profit: number;
  margin: number;
  waste: {
    units_prepared: number;
    units_wasted: number;
    cost_wasted: number;
    waste_pct: number;
    by_category: Record<string, WasteCategory>;
  };
  staff: {
    headcount: number;
    leavers: number;
    starters: number;
    turnover_rate_pct: number;
    avg_survey_score: number;
    daypart_hours: Record<string, number>;
    exit_reasons: Record<string, number>;
  };
  customer: {
    review_count: number;
    avg_rating: number;
    rating_counts: number[];
    complaints: Record<string, number>;
    sample_reviews: { rating: number; text: string; date: string }[];
  };
  footfall: {
    annual_door_count: number;
    daypart_count: Record<string, number>;
    conversion_rate_pct: number;
  };
  monthly_trend: MonthPoint[];
};

export type Product = {
  product_id: string;
  product_name: string;
  category: string;
  menu_price_gbp: number;
  unit_cost_gbp: number;
  milk_based: boolean;
  delivery_price_gbp: number;
  unit_margin_gbp: number;
  margin_pct: number;
  annual_qty: number;
  annual_revenue: number;
  annual_cogs: number;
  annual_profit: number;
  roi_pct: number;
};

export type CandidateSite = {
  site_id: string;
  site_name: string;
  city: string;
  location_type: string;
  sqft: number;
  quoted_rent_gbp_month: number;
  annual_rent_gbp: number;
  daily_footfall_street: number;
  office_workers_500m: number;
  students_1km: number;
  median_household_income_gbp: number;
  competitor_cafes_500m: number;
  area_vibrancy_index_10: number;
  est_fitout_gbp: number;
  projected_sales_gbp: number;
  projected_ebitda_gbp: number;
  projected_margin_pct: number;
  payback_years: number;
  cannibalization_risk: string;
  recommendation: string;
};

export type BudgetItem = {
  name: string;
  allocated_gbp: number;
  category: string;
  projected_annual_ebitda: number;
  payback_years: number;
  rationale: string;
};

export type Chain = {
  total_revenue: number;
  instore_revenue: number;
  app_revenue: number;
  delivery_revenue: number;
  total_labour: number;
  total_rent: number;
  total_rates: number;
  total_utilities: number;
  total_repairs: number;
  total_other_opex: number;
  total_cogs: number;
  total_delivery_commission: number;
  total_delivery_packaging: number;
  total_delivery_costs: number;
  total_expenses: number;
  total_profit: number;
  overall_margin: number;
  total_waste_cost: number;
  total_orders: number;
  total_footfall: number;
  store_count: number;
};

export type DashboardData = {
  chain: Chain;
  chain_monthly_trend: MonthPoint[];
  stores: Store[];
  products: Product[];
  candidate_sites: CandidateSite[];
  budget_plan: { total_budget_gbp: number; categories: BudgetItem[] };
  capex_history: {
    store_id: string;
    store_name: string;
    month: string;
    description: string;
    capex_gbp: number;
  }[];
  delivery_summary: {
    orders_by_bracket: { under_8: number; "8_to_15": number; "15_to_25": number; over_25: number };
    partner_summary: Record<string, { count: number; sales: number; under_8: number }>;
  };
  staff_exit_reasons: Record<string, number>;
};
