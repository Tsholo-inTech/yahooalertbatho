import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

export type DeliveryStatus = 'saved_offline' | 'sending' | 'sent' | 'failed';
export type UserEmergencyUpdate = 'I am safe' | 'Need more help' | 'False alarm';

export type EmergencyReport = {
  id: string;
  user_id: string;
  incident_type: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
  risk_level: string;
  ai_summary: string;
  status: string;
  delivery_status: DeliveryStatus;
  delivery_details: string;
  created_at: string;
};

const OFFLINE_REPORTS_KEY = '@bathoalert/offline-emergency-reports:';

async function getFunctionErrorMessage(error: { message: string; context?: unknown }) {
  const response = error.context;
  if (!(response instanceof Response)) return error.message;

  let responseBody = '';
  try {
    responseBody = await response.clone().text();
  } catch (readError) {
    console.error('Could not read the emergency delivery error response:', readError);
  }

  if (responseBody) {
    try {
      const parsed: unknown = JSON.parse(responseBody);
      if (
        parsed !== null &&
        typeof parsed === 'object' &&
        'error' in parsed &&
        typeof parsed.error === 'string'
      ) {
        return `${parsed.error} (HTTP ${response.status})`;
      }
    } catch {
      return `${responseBody.slice(0, 300)} (HTTP ${response.status})`;
    }
  }

  return `${error.message} (HTTP ${response.status})`;
}

function offlineReportsKey(userId: string) {
  return `${OFFLINE_REPORTS_KEY}${userId}`;
}

export function createEmergencyReportId() {
  const bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function getOfflineEmergencyReports(userId: string): Promise<EmergencyReport[]> {
  const stored = await AsyncStorage.getItem(offlineReportsKey(userId));
  if (!stored) return [];
  const parsed: unknown = JSON.parse(stored);
  if (
    !Array.isArray(parsed) ||
    !parsed.every((report) =>
      report !== null &&
      typeof report === 'object' &&
      typeof report.id === 'string' &&
      report.user_id === userId &&
      typeof report.incident_type === 'string' &&
      typeof report.description === 'string' &&
      typeof report.delivery_status === 'string',
    )
  ) {
    throw new Error('Saved offline emergency reports could not be read.');
  }
  return parsed as EmergencyReport[];
}

export async function saveOfflineEmergencyReport(report: EmergencyReport) {
  const reports = await getOfflineEmergencyReports(report.user_id);
  const existingIndex = reports.findIndex((item) => item.id === report.id);
  if (existingIndex >= 0) reports[existingIndex] = report;
  else reports.unshift(report);
  await AsyncStorage.setItem(offlineReportsKey(report.user_id), JSON.stringify(reports));
}

export async function removeOfflineEmergencyReport(userId: string, reportId: string) {
  const reports = await getOfflineEmergencyReports(userId);
  await AsyncStorage.setItem(
    offlineReportsKey(userId),
    JSON.stringify(reports.filter((report) => report.id !== reportId)),
  );
}

export async function sendEmergencyAlert(report: EmergencyReport): Promise<EmergencyReport> {
  const { error: sendingError } = await supabase
    .from('emergency_reports')
    .update({ delivery_status: 'sending', delivery_details: 'Contacting your emergency contacts.' })
    .eq('id', report.id)
    .eq('user_id', report.user_id);
  if (sendingError) throw sendingError;

  const { data, error } = await supabase.functions.invoke('send-emergency-alert', {
    body: {
      reportId: report.id,
      type: report.incident_type,
      description: report.description,
      latitude: report.latitude,
      longitude: report.longitude,
    },
  });
  if (error) {
    const errorMessage = await getFunctionErrorMessage(error);
    await setDeliveryFailed(report, errorMessage);
    await saveOfflineEmergencyReport({
      ...report,
      delivery_status: 'failed',
      delivery_details: errorMessage,
    });
    throw new Error(errorMessage, { cause: error });
  }
  if (
    !data ||
    typeof data.sentCount !== 'number' ||
    typeof data.totalCount !== 'number' ||
    !Array.isArray(data.failedRecipients)
  ) {
    const responseError = new Error('Emergency delivery returned an invalid response.');
    await setDeliveryFailed(report, responseError.message);
    await saveOfflineEmergencyReport({
      ...report,
      delivery_status: 'failed',
      delivery_details: responseError.message,
    });
    throw responseError;
  }

  const failedCount = data.failedRecipients.length;
  const deliveryStatus: DeliveryStatus = data.sentCount > 0 ? 'sent' : 'failed';
  const deliveryDetails = data.sentCount > 0
    ? failedCount > 0
      ? `Twilio accepted ${data.sentCount} of ${data.totalCount} message(s); ${failedCount} could not be sent.`
      : `Twilio accepted the message(s) for ${data.sentCount} contact(s).`
    : failedCount > 0
      ? `Could not send to ${failedCount} contact(s).`
      : 'No emergency contacts are configured.';
  const inboxWarning =
    typeof data.inboxWarning === 'string' ? data.inboxWarning : '';
  const finalDeliveryDetails = [deliveryDetails, inboxWarning].filter(Boolean).join(' ');

  const { error: updateError } = await supabase
    .from('emergency_reports')
    .update({ delivery_status: deliveryStatus, delivery_details: finalDeliveryDetails })
    .eq('id', report.id)
    .eq('user_id', report.user_id);
  if (updateError) {
    await saveOfflineEmergencyReport({
      ...report,
      delivery_status: deliveryStatus,
      delivery_details: finalDeliveryDetails,
    });
    throw updateError;
  }

  return { ...report, delivery_status: deliveryStatus, delivery_details: finalDeliveryDetails };
}

async function setDeliveryFailed(report: EmergencyReport, details: string) {
  const { error } = await supabase
    .from('emergency_reports')
    .update({ delivery_status: 'failed', delivery_details: details })
    .eq('id', report.id)
    .eq('user_id', report.user_id);
  if (error) {
    console.error('Could not save emergency delivery failure status:', error);
  }
}

export async function syncOfflineEmergencyReports(userId: string) {
  const reports = await getOfflineEmergencyReports(userId);
  for (const report of reports) {
    if (report.delivery_status !== 'saved_offline') continue;
    const sendingReport: EmergencyReport = {
      ...report,
      delivery_status: 'sending',
      delivery_details: 'Sending saved alert.',
    };

    const { error: saveError } = await supabase
      .from('emergency_reports')
      .upsert(sendingReport, { onConflict: 'id' });
    if (saveError) {
      console.error('Could not sync an offline emergency report:', saveError);
      continue;
    }

    await saveOfflineEmergencyReport(sendingReport);
    try {
      await sendEmergencyAlert(sendingReport);
      await removeOfflineEmergencyReport(userId, report.id);
    } catch (error) {
      console.error('Could not deliver a synced emergency alert:', error);
      const currentReports = await getOfflineEmergencyReports(userId);
      const currentReport = currentReports.find((item) => item.id === report.id);
      if (!currentReport || currentReport.delivery_status === 'sending') {
        await saveOfflineEmergencyReport({
          ...sendingReport,
          delivery_status: 'failed',
          delivery_details: error instanceof Error ? error.message : 'Alert delivery failed.',
        });
      }
    }
  }
}
