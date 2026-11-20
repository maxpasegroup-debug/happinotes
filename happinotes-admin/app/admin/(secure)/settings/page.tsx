import { redirect } from 'next/navigation';

export default function AdminSettingsPage() {
  redirect('/admin/google-play?tab=subscriptions');
}
