import * as functions from 'firebase-functions';
/**
 * HTTP Cloud Function to send emails
 * Sends FROM your Gmail account TO any recipient
 * Call from app: POST /api/email/send
 */
export declare const sendEmail: functions.HttpsFunction;
/**
 * Firestore trigger to send password reset emails
 * Triggered when a document is created in passwordResetCodes collection
 * Sends TO the user's email FROM your Gmail account
 */
export declare const onPasswordResetCodeCreated: functions.CloudFunction<functions.firestore.QueryDocumentSnapshot>;
//# sourceMappingURL=email.d.ts.map