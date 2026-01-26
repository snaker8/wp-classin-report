import { Metadata } from 'next';
import ReportClient from './ReportClient';

interface Props {
    params: { id: string };
}

// Fetch report data for metadata using Firestore REST API
// This avoids using the Firebase Client SDK in a Server Component
async function getReport(id: string) {
    if (!id) return null;

    try {
        const projectId = 'wp-classin-report'; // Hardcoded for server-side stability
        const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/reports/${id}`;

        const res = await fetch(url, { next: { revalidate: 60 } }); // Cache for 1 min

        if (!res.ok) {
            console.error('Failed to fetch report metadata:', res.statusText);
            return null;
        }

        const data = await res.json();
        // Parse Firestore REST format
        const fields = data.fields;

        return {
            studentName: fields?.studentName?.stringValue || '학생',
            // Add other fields if needed for description
        };
    } catch (error) {
        console.error('Error fetching report for metadata:', error);
        return null;
    }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const report = await getReport(params.id);

    if (!report) {
        return {
            title: '학습 리포트 | 과사람 의대관',
        };
    }

    return {
        title: `${report.studentName} - 학습 리포트 | 과사람 의대관`,
        description: '과사람 의대관 Premium Math Report',
    };
}

export default function ReportPage({ params }: Props) {
    return <ReportClient id={params.id} />;
}
