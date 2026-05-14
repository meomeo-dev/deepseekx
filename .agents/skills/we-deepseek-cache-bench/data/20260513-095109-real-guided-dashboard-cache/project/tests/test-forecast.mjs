// Forecasting — domain module tests.
import { bucketByMonth, bucketByWeek, linearTrend, seasonalityFactors } from "../scripts/forecasting/time-series.js";
import { projectARR, arrForecastSummary } from "../scripts/forecasting/arr-projection.js";
import { projectChurn, churnRiskBySegment } from "../scripts/forecasting/churn-forecast.js";
import { projectExpansion } from "../scripts/forecasting/expansion-pipeline.js";
import { projectSupportLoad } from "../scripts/forecasting/support-staffing.js";
import { projectIncidentRisk } from "../scripts/forecasting/incident-risk-forecast.js";
import { projectDeployStability } from "../scripts/forecasting/deploy-stability-trend.js";
import { buildScenarios, runScenario, compareScenarios } from "../scripts/forecasting/scenario-modeling.js";
import { generateNarrative } from "../scripts/forecasting/executive-narrative.js";

const NOW = Date.now();
const DAY = 86400000;
let passed=0,failed=0,total=0;
function assert(c,l){total++;if(c)passed++;else{failed++;console.error(`  FAIL: ${l}`)}}
function eq(a,e,l){total++;const x=JSON.stringify(a),y=JSON.stringify(e);if(x===y)passed++;else{failed++;console.error(`  FAIL: ${l} — expected ${y}, got ${x}`)}}

// ==================== Time-Series ====================
console.log("\n=== Time-Series Tests ===");
const events=[{ts:NOW-60*DAY,v:100},{ts:NOW-50*DAY,v:120},{ts:NOW-30*DAY,v:90},{ts:NOW-10*DAY,v:110}];
const mb=bucketByMonth(events,"ts","v");
assert(mb.length>=2,"Monthly buckets created");
const wb=bucketByWeek(events,"ts","v",4);
assert(wb.length===4,"4 weekly buckets");
const trend=linearTrend(mb,"sum");
assert(typeof trend.slope==="number","Trend has slope");
assert(["up","down","flat"].includes(trend.direction),"Trend direction valid");
const sf=seasonalityFactors(mb,"sum");
assert(typeof sf==="object","Seasonality factors object");

// ==================== ARR Projection ====================
console.log("\n=== ARR Projection Tests ===");
const proj=projectARR(100000,500,0.025,0.018,12,{seasonality:{"01":1.1}});
eq(proj.length,12,"12 month projection");
assert(proj[0].projected_arr>0,"First month has ARR");
const sum=arrForecastSummary(proj,{Q1:1300000,Q2:1380000});
assert(sum.growth_rate_12m!==undefined,"Growth rate computed");
assert(sum.vs_targets.Q1!==undefined,"Q1 target comparison");

// ==================== Churn Forecast ====================
console.log("\n=== Churn Forecast Tests ===");
const accts=[{id:"a1",name:"A",mrr:10000,health:"healthy"},{id:"a2",name:"B",mrr:5000,health:"at_risk"},{id:"a3",name:"C",mrr:2000,health:"healthy"},{id:"a4",name:"D",mrr:8000,health:"churned"}];
const cf=projectChurn(accts,[],[],{base_churn_rate:0.025});
eq(cf.monthly.length,12,"12 month churn forecast");
assert(cf.total_12m_churn_arr>0,"Total churn ARR > 0");
const cbs=churnRiskBySegment(accts);
assert(cbs.length>=1,"Churn by segment has entries");

// ==================== Expansion Pipeline ====================
console.log("\n=== Expansion Pipeline Tests ===");
const fix={expansionSignals:[{account_id:"a1",timestamp:NOW-20*DAY},{account_id:"a2",timestamp:NOW-50*DAY}],featureAdoption:{}};
const ep=projectExpansion(accts,fix,{});
assert(ep.pipeline.length===12,"12 month pipeline");
assert(ep.total_12m_expansion_arr>=0,"Expansion ARR >= 0");

// ==================== Support Staffing ====================
console.log("\n=== Support Staffing Tests ===");
const tickets=[{created_at:NOW-10*DAY},{created_at:NOW-20*DAY},{created_at:NOW-30*DAY}];
const sl=projectSupportLoad(tickets,accts,{account_growth_rate:0.01,current_agents:3});
eq(sl.monthly.length,12,"12 month support forecast");
assert(sl.total_12m_tickets>0,"Total tickets > 0");

// ==================== Incident Risk ====================
console.log("\n=== Incident Risk Forecast Tests ===");
const incs=[{opened_at:NOW-10*DAY,severity:"sev1"},{opened_at:NOW-30*DAY,severity:"sev2"}];
const deploys=[{started_at:NOW-5*DAY,risk_score:3}];
const ir=projectIncidentRisk(incs,deploys,{});
eq(ir.monthly.length,12,"12 month incident forecast");
assert(ir.avg_monthly_incidents>=0,"Avg incidents >= 0");

// ==================== Deploy Stability ====================
console.log("\n=== Deploy Stability Tests ===");
const deps=[{started_at:NOW-10*DAY,status:"completed",risk_score:3},{started_at:NOW-30*DAY,status:"rolled_back",risk_score:8}];
const ds=projectDeployStability(deps,{},{});  
assert(ds.historical.length>=1,"Historical data present");
assert(ds.current_avg_risk>0,"Current avg risk > 0");

// ==================== Scenario Modeling ====================
console.log("\n=== Scenario Modeling Tests ===");
const params={currentMRR:100000,churnRate:0.025,expansionRate:0.018,organicGrowth:500,monthsAhead:12};
const scenarios=buildScenarios(params);
assert(Object.keys(scenarios).length===4,"4 scenarios defined");
const rs=runScenario(params,scenarios.baseline,12);
eq(rs.projections.length,12,"12 month scenario run");
const comp=compareScenarios(params,12);
assert(comp.spread>0,"Scenario spread > 0");
assert(comp.scenarios.optimistic.terminal_arr>=comp.scenarios.baseline.terminal_arr,"Optimistic >= baseline");

// ==================== Executive Narrative ====================
console.log("\n=== Executive Narrative Tests ===");
const narr=generateNarrative(sum,cf,ep,ir,ds,comp);
assert(narr.sections.length>=5,"5+ narrative sections");
assert(["positive","mixed","caution"].includes(narr.overall_signal),"Valid overall signal");
assert(narr.overall_summary.length>20,"Overall summary present");

console.log(`\n=== Results: ${passed}/${total} passed, ${failed} failed ===`);
process.exit(failed>0?1:0);
