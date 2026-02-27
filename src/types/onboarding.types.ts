export interface ManagerProfile {
  name: string;
  email: string;
  role: string;
  experienceYears: number;
  managementStyle: string;
  strengths: string[];
  developmentAreas: string[];
}

export interface CareerGoals {
  shortTerm: string;
  longTerm: string;
  targetRole: string;
}

export interface LeadershipContext {
  managerName: string;
  managerEmail: string;
  expectations: string;
}

export interface OnboardingData {
  provider: string;
  apiKey: string;
  workspacePath: string;
  profile: ManagerProfile;
  careerGoals: CareerGoals;
  leadershipContext: LeadershipContext;
}
