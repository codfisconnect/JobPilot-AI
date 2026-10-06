import { ApplicationStatus } from '@prisma/client';
import { BadRequestError } from '../../utils/errors.js';

/**
 * Valid state transitions for applications:
 * SAVED -> READY_TO_APPLY, APPLIED, WITHDRAWN
 * READY_TO_APPLY -> APPLIED, SAVED, WITHDRAWN
 * APPLIED -> ASSESSMENT, HR_SCREEN, TECHNICAL, OFFER, REJECTED, WITHDRAWN
 * ASSESSMENT -> HR_SCREEN, TECHNICAL, OFFER, REJECTED, WITHDRAWN
 * HR_SCREEN -> TECHNICAL, FINAL_ROUND, OFFER, REJECTED, WITHDRAWN
 * TECHNICAL -> FINAL_ROUND, OFFER, REJECTED, WITHDRAWN
 * FINAL_ROUND -> OFFER, REJECTED, WITHDRAWN
 * OFFER -> WITHDRAWN (accept/decline handled via notes or status), REJECTED
 * REJECTED -> none (terminal, unless explicitly reopened to WITHDRAWN or APPLIED in rare review cases)
 * WITHDRAWN -> none (terminal, unless reopened to READY_TO_APPLY or SAVED)
 */

export const ALLOWED_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  [ApplicationStatus.SAVED]: [
    ApplicationStatus.READY_TO_APPLY,
    ApplicationStatus.APPLIED,
    ApplicationStatus.WITHDRAWN
  ],
  [ApplicationStatus.READY_TO_APPLY]: [
    ApplicationStatus.SAVED,
    ApplicationStatus.APPLIED,
    ApplicationStatus.WITHDRAWN
  ],
  [ApplicationStatus.APPLIED]: [
    ApplicationStatus.ASSESSMENT,
    ApplicationStatus.HR_SCREEN,
    ApplicationStatus.TECHNICAL,
    ApplicationStatus.FINAL_ROUND,
    ApplicationStatus.OFFER,
    ApplicationStatus.REJECTED,
    ApplicationStatus.WITHDRAWN
  ],
  [ApplicationStatus.ASSESSMENT]: [
    ApplicationStatus.HR_SCREEN,
    ApplicationStatus.TECHNICAL,
    ApplicationStatus.FINAL_ROUND,
    ApplicationStatus.OFFER,
    ApplicationStatus.REJECTED,
    ApplicationStatus.WITHDRAWN
  ],
  [ApplicationStatus.HR_SCREEN]: [
    ApplicationStatus.ASSESSMENT,
    ApplicationStatus.TECHNICAL,
    ApplicationStatus.FINAL_ROUND,
    ApplicationStatus.OFFER,
    ApplicationStatus.REJECTED,
    ApplicationStatus.WITHDRAWN
  ],
  [ApplicationStatus.TECHNICAL]: [
    ApplicationStatus.FINAL_ROUND,
    ApplicationStatus.OFFER,
    ApplicationStatus.REJECTED,
    ApplicationStatus.WITHDRAWN
  ],
  [ApplicationStatus.FINAL_ROUND]: [
    ApplicationStatus.OFFER,
    ApplicationStatus.REJECTED,
    ApplicationStatus.WITHDRAWN
  ],
  [ApplicationStatus.OFFER]: [
    ApplicationStatus.WITHDRAWN,
    ApplicationStatus.REJECTED
  ],
  [ApplicationStatus.REJECTED]: [
    ApplicationStatus.APPLIED, // Allow appeal / re-evaluation
    ApplicationStatus.WITHDRAWN
  ],
  [ApplicationStatus.WITHDRAWN]: [
    ApplicationStatus.SAVED,
    ApplicationStatus.READY_TO_APPLY,
    ApplicationStatus.APPLIED
  ]
};

export class ApplicationStatusService {
  public static validateTransition(currentStatus: ApplicationStatus, targetStatus: ApplicationStatus): void {
    if (currentStatus === targetStatus) {
      throw new BadRequestError(`Application is already in status '${targetStatus}'`);
    }

    const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      throw new BadRequestError(
        `Invalid status transition from '${currentStatus}' to '${targetStatus}'. Allowed transitions: ${allowed.join(', ')}`
      );
    }
  }

  public static isInterviewStage(status: ApplicationStatus): boolean {
    const interviewStages: ApplicationStatus[] = [
      ApplicationStatus.ASSESSMENT,
      ApplicationStatus.HR_SCREEN,
      ApplicationStatus.TECHNICAL,
      ApplicationStatus.FINAL_ROUND
    ];
    return interviewStages.includes(status);
  }

  public static isActiveStage(status: ApplicationStatus): boolean {
    const inactiveStages: ApplicationStatus[] = [
      ApplicationStatus.REJECTED,
      ApplicationStatus.WITHDRAWN
    ];
    return !inactiveStages.includes(status);
  }
}
