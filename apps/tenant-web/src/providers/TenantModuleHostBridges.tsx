import React from "react";
import { ContactsHostBridge } from "@/providers/ContactsHostProvider";
import { HasanatHostBridge } from "@/providers/HasanatHostProvider";
import { FacultyHostBridge } from "@/providers/FacultyHostProvider";
import { FinanceHostBridge } from "@/providers/FinanceHostProvider";
import { StudentsHostBridge } from "@/providers/StudentsHostProvider";
import { SessionsHostBridge } from "@/providers/SessionsHostProvider";
import { EnrollmentsHostBridge } from "@/providers/EnrollmentsHostProvider";
import { MessagingHostBridge } from "@/providers/MessagingHostProvider";

/**
 * Composes all 8 vertical-module host bridges inside the lazy authenticated shell (`AppLayout`)
 * so every module route has its host configured without bloating the public entry bundle.
 */
export function TenantModuleHostBridges({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <ContactsHostBridge>
      <HasanatHostBridge>
        <FacultyHostBridge>
          <FinanceHostBridge>
            <StudentsHostBridge>
              <SessionsHostBridge>
                <EnrollmentsHostBridge>
                  <MessagingHostBridge>{children}</MessagingHostBridge>
                </EnrollmentsHostBridge>
              </SessionsHostBridge>
            </StudentsHostBridge>
          </FinanceHostBridge>
        </FacultyHostBridge>
      </HasanatHostBridge>
    </ContactsHostBridge>
  );
}
