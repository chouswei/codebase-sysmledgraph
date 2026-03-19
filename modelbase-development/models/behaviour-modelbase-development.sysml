/*
  Model-based development behaviour: Plan flows to implement side (develop);
  report flows from implement side to modelbase. Only modelbase decides if
  iteration is done and updates plan for next iteration. Plan → develop →
  deploy → integrate → verify → report → update (decide); repeat = iteration.
*/
package ModelbaseDevelopmentBehaviour {
  private import ModelbaseDevelopment::*;
  private import ModelbaseDevelopmentRequirements::*;

  action def Plan {
    doc /* Modelbase: produce or update the plan (to do) from the model. */
    out item plan : DevelopmentPlan;
    satisfy ReqWorkflowDescribed;
    satisfy ReqPlanFromModelbase;
  }

  action def DoSoftwareDevelopment {
    doc /* Implement side (e.g. codebase): execute software development against plan and model. */
    in item plan : DevelopmentPlan;
    satisfy ReqWorkflowDescribed;
  }

  action def DoHardwareDevelopment {
    doc /* Implement side (e.g. hardware repo): execute hardware development against plan and model. */
    in item plan : DevelopmentPlan;
    satisfy ReqWorkflowDescribed;
  }

  action def DoMechanismDevelopment {
    doc /* Implement side (e.g. mechanism repo): execute mechanism development against plan and model. */
    in item plan : DevelopmentPlan;
    satisfy ReqWorkflowDescribed;
  }

  action def DoSystemDeployment {
    doc /* Implement side (e.g. deployment repo): define and execute system deployment (integration, topology). */
    in item plan : DevelopmentPlan;
    satisfy ReqWorkflowDescribed;
  }

  action def Integrate {
    doc /* Implement side: integrate SW/HW/mechanism outputs into the system. */
    satisfy ReqWorkflowDescribed;
  }

  action def Verify {
    doc /* Implement side: verify implementation vs plan and model; feeds implement report. */
    satisfy ReqWorkflowDescribed;
  }

  action def ProduceImplementReport {
    doc /* Implement side: produce implement report (alignment, gaps, traceability); deliver to modelbase. Implement side only gives the report; does not decide if iteration is done. */
    out item report : ImplementReport;
    satisfy ReqWorkflowDescribed;
    satisfy ReqReportFromImplementSide;
    satisfy ReqTraceability;
  }

  action def UpdateModelFromGaps {
    doc /* Modelbase: receive report; decide whether iteration is done; if done, update plan for next iteration (or close); if not, plan unchanged. Only modelbase decides. */
    in item report : ImplementReport;
    satisfy ReqIteration;
    satisfy ReqWorkflowDescribed;
    satisfy ReqPlanFromModelbase;
    satisfy ReqDecideByModelbase;
  }

  action def ModelBasedDevelopmentIteration {
    doc /* One iteration: plan → develop → report → update. Only modelbase decides if iteration is done and updates plan for next iteration; implement side only delivers report. Repeat. */
    action plan : Plan;
    action doSoftware : DoSoftwareDevelopment;
    action doHardware : DoHardwareDevelopment;
    action doMechanism : DoMechanismDevelopment;
    action doDeploy : DoSystemDeployment;
    action integrate : Integrate;
    action verify : Verify;
    action produceImplementReport : ProduceImplementReport;
    action updateFromGaps : UpdateModelFromGaps;
    flow from plan.plan to doSoftware.plan;
    flow from plan.plan to doHardware.plan;
    flow from plan.plan to doMechanism.plan;
    flow from plan.plan to doDeploy.plan;
    flow from produceImplementReport.report to updateFromGaps.report;
    then plan;
    then doSoftware;
    then doHardware;
    then doMechanism;
    then doDeploy;
    then integrate;
    then verify;
    then produceImplementReport;
    then updateFromGaps;
    satisfy ReqWorkflowDescribed;
    satisfy ReqIteration;
  }
}
