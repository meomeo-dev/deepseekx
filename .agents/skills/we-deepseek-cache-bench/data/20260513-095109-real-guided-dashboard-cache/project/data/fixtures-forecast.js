// Forecast fixtures — assumptions, seasonality, targets, scenarios, bets, notes.

export function seedForecastAssumptions() {
  return {
    base_churn_rate: 0.025,
    expansion_rate: 0.018,
    organic_growth: 1200,
    account_growth_rate: 0.015,
    tickets_per_account: 1.8,
    current_agents: 6,
    deploy_growth_rate: 0.02,
    sev0_probability: 0.03,
    sev1_probability: 0.12,
    expansion_conversion: {
      stage_1_to_2: 0.30,
      stage_2_to_3: 0.40,
      stage_3_to_close: 0.55,
    },
    seasonality: {
      "01": 1.15, "02": 1.05, "03": 1.10, "04": 0.95,
      "05": 0.90, "06": 0.85, "07": 0.80, "08": 0.90,
      "09": 1.05, "10": 1.10, "11": 1.20, "12": 1.25,
    },
  };
}

export function seedQuarterlyTargets() {
  return {
    Q1: 13000000,
    Q2: 13800000,
    Q3: 14700000,
    Q4: 15800000,
  };
}

export function seedBudgetConstraints() {
  return {
    max_new_hires_per_quarter: 3,
    max_infra_spend_monthly: 85000,
    r_and_d_budget_quarterly: 450000,
    cs_budget_per_account: 1200,
  };
}

export function seedRoadmapBets() {
  return [
    { id: "bet_1", name: "Enterprise SSO overhaul", est_arr_impact: 420000, probability: 0.6, eta_months: 6, category: "platform" },
    { id: "bet_2", name: "AI-powered reporting", est_arr_impact: 650000, probability: 0.45, eta_months: 9, category: "product" },
    { id: "bet_3", name: "Self-serve onboarding v2", est_arr_impact: 280000, probability: 0.75, eta_months: 3, category: "growth" },
    { id: "bet_4", name: "Multi-region deployment", est_arr_impact: 520000, probability: 0.5, eta_months: 8, category: "infrastructure" },
    { id: "bet_5", name: "Marketplace integrations", est_arr_impact: 380000, probability: 0.55, eta_months: 5, category: "ecosystem" },
  ];
}

export function seedExecutiveNotes() {
  return [
    { date: Date.now() - 90 * 86400000, author: "ceo", note: "Board expects 15% ARR growth this fiscal year. Need to close expansion gap." },
    { date: Date.now() - 60 * 86400000, author: "cfo", note: "Cash collection efficiency needs improvement. DSO target: under 45 days." },
    { date: Date.now() - 30 * 86400000, author: "cto", note: "Deploy risk trending up. Recommend freeze on non-critical deploys in Q4." },
    { date: Date.now() - 14 * 86400000, author: "cro", note: "Q3 pipeline looks healthy. Expansion accounts up 12% QoQ. Churn concern in SMB segment." },
  ];
}

export function seedAllForecastFixtures() {
  return {
    forecastAssumptions: seedForecastAssumptions(),
    quarterlyTargets: seedQuarterlyTargets(),
    budgetConstraints: seedBudgetConstraints(),
    roadmapBets: seedRoadmapBets(),
    executiveNotes: seedExecutiveNotes(),
  };
}
