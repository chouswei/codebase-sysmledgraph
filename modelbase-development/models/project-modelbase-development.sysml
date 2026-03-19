/*
  Project-level grouping for modelbase-development. Imports all project packages.
  Convention: project-<name>.sysml contains package Project<NamePascalCase> that
  imports requirements, deploy, behaviour.
*/
package ProjectModelbaseDevelopment {
  private import ModelbaseDevelopmentRequirements::*;
  private import ModelbaseDevelopment::*;
  private import ModelbaseDevelopmentBehaviour::*;
}
