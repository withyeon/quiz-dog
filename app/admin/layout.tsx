import { ReactNode } from 'react'
import { AdminGate } from '@/components/admin/AdminGate'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { AdminNav } from '@/components/admin/AdminNav'
import { Toaster } from '@/components/ui/Toaster'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminGate>
      <div className="min-h-dvh bg-[#f7f8fa]">
        <AdminHeader />
        <div className="flex">
          <AdminNav />
          <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
        <Toaster />
      </div>
    </AdminGate>
  )
}
