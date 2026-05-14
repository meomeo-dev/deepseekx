import { scoreFeatureAdoption, batchScoreAdoption, adoptionSummary } from "../scripts/usage/feature-adoption-scoring.js";
import { analyzeSeatUtilization, batchAnalyzeSeats, seatUtilizationSummary } from "../scripts/usage/seat-utilization.js";
import { cohortByUsageLevel, detectUsageTrend, batchDetectTrends } from "../scripts/usage/usage-cohorting.js";
import { trackOnboarding, batchTrackOnboarding, onboardingSummary } from "../scripts/usage/onboarding-tracking.js";
import { detectPQA, batchDetectPQA, pqaSummary } from "../scripts/usage/pqa-detection.js";
import { detectBlockers, batchDetectBlockers, blockerSummary } from "../scripts/usage/adoption-blockers.js";
import { triageAnomalies } from "../scripts/usage/anomaly-triage.js";
import { recommendPlaybooks, batchRecommend, playbookSummary } from "../scripts/usage/adoption-playbooks.js";

const NOW = Date.now();
const DAY = 86400000;
let passed=0,failed=0,total=0;
function assert(c,l){total++;if(c)passed++;else{failed++;console.error(`  FAIL: ${l}`)}}
function eq(a,e,l){total++;const x=JSON.stringify(a),y=JSON.stringify(e);if(x===y)passed++;else{failed++;console.error(`  FAIL: ${l} — expected ${y}, got ${x}`)}}

const acct = {id:"a1",name:"Alpha",plan:"Growth",health:"healthy",mrr:5000,created_at:NOW-200*DAY};
const catalog = [{id:"f1",name:"Dashboard"},{id:"f2",name:"Reporting"},{id:"f3",name:"API"},{id:"f4",name:"Webhooks"},{id:"f5",name:"Automations"}];
const adoption = {a1:{adopted_features:["f1","f2","f3"],feature_depth:{f1:80,f2:60,f3:40},unused_features:["f4","f5"]}};
const accounts = [acct,{id:"a2",name:"Beta",plan:"Starter",health:"at_risk",mrr:2000,created_at:NOW-30*DAY}];

console.log("\n=== Feature Adoption Scoring ===");
const sc = scoreFeatureAdoption(acct, adoption, catalog);
assert(sc.overall_score > 0,"Adoption score computed");
assert(sc.level === "engaged" || sc.level === "power_user","Adoption level set");
assert(sc.recommendations.length > 0,"Recommendations generated");
const batch = batchScoreAdoption(accounts, adoption, catalog);
eq(batch.length, 2,"Batch scores 2 accounts");
const adSum = adoptionSummary(batch);
assert(adSum.avg_score > 0,"Avg adoption score");

console.log("\n=== Seat Utilization ===");
const seats = {a1:[{user_name:"u1",last_active:NOW-2*DAY},{user_name:"u2",last_active:NOW-40*DAY},{user_name:"u3",last_active:null}]};
const sa = analyzeSeatUtilization(acct, seats, 30);
eq(sa.active_seats, 1,"1 active seat");
assert(sa.utilization_pct < 100,"Under 100% utilization");
const seatBatch = batchAnalyzeSeats(accounts, seats);
assert(seatBatch.length >= 1,"Batch seat analysis");
const seatSum = seatUtilizationSummary(seatBatch);
assert(seatSum.total_inactive_seats > 0,"Inactive seats detected");

console.log("\n=== Usage Cohorting ===");
const usageEvents = [{account_id:"a1",timestamp:NOW-5*DAY,value:80},{account_id:"a1",timestamp:NOW-3*DAY,value:75}];
const cohorts = cohortByUsageLevel(accounts, usageEvents);
assert(cohorts.heavy.count + cohorts.moderate.count + cohorts.light.count + cohorts.dormant.count === 2,"All accounts cohorted");
const trend = detectUsageTrend(acct, usageEvents);
assert(["growing","stable","declining","insufficient_data","new_account"].includes(trend.trend),"Trend valid");

console.log("\n=== Onboarding Tracking ===");
const onbEvents = [{account_id:"a1",milestone_id:"account_created",completed:true,completed_at:acct.created_at},{account_id:"a1",milestone_id:"first_login",completed:true,completed_at:acct.created_at+2*DAY}];
const onb = trackOnboarding(acct, onbEvents);
assert(onb.progress_pct > 0,"Onboarding progress");
const onbBatch = batchTrackOnboarding(accounts, onbEvents);
assert(onbBatch.length >= 1,"Batch onboarding");
const onbSum = onboardingSummary(onbBatch);
assert(onbSum.total_accounts >= 1,"Onboarding summary");

console.log("\n=== PQA Detection ===");
const pqa = detectPQA(acct, usageEvents, adoption, []);
assert(pqa.pqa_score >= 0,"PQA score computed");
const pqaBatch = batchDetectPQA(accounts, usageEvents, adoption, []);
assert(pqaBatch.length >= 1,"Batch PQA");
const pqaSum = pqaSummary(pqaBatch);
assert(pqaSum.total >= 1,"PQA summary");

console.log("\n=== Adoption Blockers ===");
const blk = detectBlockers(acct, adoption, [], [], [], []);
assert(typeof blk.blocker_count === "number","Blocker count");
const blkBatch = batchDetectBlockers(accounts, adoption, [], [], [], []);
const blkSum = blockerSummary(blkBatch);
assert(blkSum.total_blockers >= 0,"Blocker summary");

console.log("\n=== Anomaly Triage ===");
const anomalies = [{account_id:"a1",type:"drop",severity:"high",description:"Usage dropped",timestamp:NOW-10*DAY}];
const triage = triageAnomalies(anomalies, accounts, usageEvents);
assert(triage.length > 0,"Anomalies triaged");
assert(triage[0].priority.length > 0,"Anomaly priority set");

console.log("\n=== Adoption Playbooks ===");
const ctx = {adoptionScore:25,adoptionLevel:"light",unusedFeatures:3,featureDepth:20,mrr:5000,health:"healthy",seatUtilization:40,onboardingStuck:true,progressPct:25,usageLevel:"light"};
const plays = recommendPlaybooks(ctx);
assert(plays.length > 0,"Playbooks recommended");
const batchPlays = batchRecommend(accounts, a => ({...ctx,adoptionScore:a.id==="a1"?25:60}));
const playSum = playbookSummary(batchPlays);
assert(playSum.total_matches > 0,"Playbook summary");

console.log(`\n=== Results: ${passed}/${total} passed, ${failed} failed ===`);
process.exit(failed>0?1:0);
