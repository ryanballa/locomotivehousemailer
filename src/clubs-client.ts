import {
  Tower,
  Report,
  User,
  TowerWithMissingReport,
  TowerWithOwnerEmail,
  MailerConfig,
  AuthMethod,
} from './types';

interface ReportsResponse {
  data: Report[];
}

interface TowersResponse {
  data: Tower[];
}

interface UserResponse {
  data: User;
}

interface UsersResponse {
  data: User[];
}

export class ClubsClient {
  private apiBaseUrl: string;
  private authMethod: AuthMethod;
  private authToken?: string;
  private clerkRefreshToken?: string;

  constructor(config: MailerConfig) {
    this.apiBaseUrl = config.apiBaseUrl;
    this.authMethod = config.authMethod;

    if (config.authMethod === 'clerk') {
      this.clerkRefreshToken = config.clerkRefreshToken;
    } else {
      this.authToken = config.apiJwtToken;
    }
  }

  private getAuthHeader(): string {
    if (this.authMethod === 'clerk') {
      if (!this.clerkRefreshToken) {
        throw new Error('Clerk refresh token not configured');
      }
      return `Bearer ${this.clerkRefreshToken}`;
    } else {
      if (!this.authToken) {
        throw new Error('JWT token not configured');
      }
      return `Bearer ${this.authToken}`;
    }
  }

  async getReports(
    clubId: number,
    year: number,
    month: number
  ): Promise<Report[]> {
    try {
      const url = new URL(`/api/clubs/${clubId}/reports`, this.apiBaseUrl);
      url.searchParams.set('year', year.toString());
      url.searchParams.set('month', month.toString());

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch reports: ${response.status} ${response.statusText}`
        );
      }

      const result = (await response.json()) as ReportsResponse;
      return result.data || [];
    } catch (error) {
      console.error(`Error fetching reports for club ${clubId}:`, error);
      throw error;
    }
  }

  async getTowers(clubId: number): Promise<Tower[]> {
    try {
      const url = new URL(`/api/clubs/${clubId}/towers`, this.apiBaseUrl);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch towers: ${response.status} ${response.statusText}`
        );
      }

      const result = (await response.json()) as TowersResponse;
      return result.data || [];
    } catch (error) {
      console.error(`Error fetching towers for club ${clubId}:`, error);
      throw error;
    }
  }

  private async getUser(userId: number): Promise<User | null> {
    try {
      const url = new URL(`/api/users/${userId}`, this.apiBaseUrl);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn(`Failed to fetch user ${userId}: ${response.status}`);
        return null;
      }

      const result = (await response.json()) as UserResponse;
      return result.data || null;
    } catch (error) {
      console.error(`Error fetching user ${userId}:`, error);
      return null;
    }
  }

  async findTowersLackingReports(
    clubId: number,
    year: number,
    month: number
  ): Promise<Tower[]> {
    try {
      const [towers, reports] = await Promise.all([
        this.getTowers(clubId),
        this.getReports(clubId, year, month),
      ]);

      const reportedTowerIds = new Set(reports.map((r) => r.tower_id));
      const towersLackingReports = towers.filter(
        (tower) => !reportedTowerIds.has(tower.id)
      );

      return towersLackingReports;
    } catch (error) {
      console.error(
        `Error finding towers lacking reports for club ${clubId}:`,
        error
      );
      throw error;
    }
  }

  async findTowersLackingReportsWithOwnerEmail(
    clubId: number,
    year: number,
    month: number
  ): Promise<TowerWithOwnerEmail[]> {
    try {
      const [towers, reports] = await Promise.all([
        this.getTowers(clubId),
        this.getReports(clubId, year, month),
      ]);

      const reportedTowerIds = new Set(reports.map((r) => r.tower_id));
      const towersLackingReports = towers.filter(
        (tower) => !reportedTowerIds.has(tower.id)
      );

      // Fetch owner information for each tower that lacks a report
      const towersWithOwnerEmail: TowerWithOwnerEmail[] = await Promise.all(
        towersLackingReports.map(async (tower) => {
          const owner = tower.owner_id ? await this.getUser(tower.owner_id) : null;
          return {
            ...tower,
            ownerEmail: owner?.email,
            ownerName: owner?.name,
          };
        })
      );

      return towersWithOwnerEmail;
    } catch (error) {
      console.error(
        `Error finding towers lacking reports with owner email for club ${clubId}:`,
        error
      );
      throw error;
    }
  }

  async getTowersWithReportStatus(
    clubId: number,
    year: number,
    month: number
  ): Promise<TowerWithMissingReport[]> {
    try {
      const [towers, reports] = await Promise.all([
        this.getTowers(clubId),
        this.getReports(clubId, year, month),
      ]);

      const reportedTowerIds = new Set(reports.map((r) => r.tower_id));
      const towersWithStatus: TowerWithMissingReport[] = towers.map(
        (tower) => ({
          ...tower,
          hasReport: reportedTowerIds.has(tower.id),
        })
      );

      return towersWithStatus;
    } catch (error) {
      console.error(
        `Error getting towers with report status for club ${clubId}:`,
        error
      );
      throw error;
    }
  }
}
