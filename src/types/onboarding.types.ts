export interface ManagerProfile {
  name: string;
  email: string;
  role: string;
  location?: string;
}

export interface LeadershipContext {
  managerName: string;
  managerEmail: string;
}

export interface TeamMember {
  email: string;
  name: string;
  gender: string;
  role: string;
  location?: string;
}

export interface OnboardingData {
  provider: string;
  apiKey: string;
  workspacePath: string;
  profile: ManagerProfile;
  leadershipContext: LeadershipContext;
  teamMembers: TeamMember[];
}
