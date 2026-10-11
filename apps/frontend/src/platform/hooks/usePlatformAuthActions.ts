import { useMutation } from "@tanstack/react-query";
import type {
  PlatformPasswordForgotInput,
  PlatformPasswordForgotResult,
  PlatformPasswordResetInput,
  PlatformSetupRegisterInput,
  PlatformSetupRegisterResult,
  PlatformUser,
} from "@mms/shared";
import { apiContract } from "@/lib/api";

/** Hook to start platform setup registration. */
export function usePlatformSetupRegister() {
  return useMutation({
    mutationFn: async (input: PlatformSetupRegisterInput) => {
      const res = await apiContract.platform.setupRegister({ body: input });
      return res.body as PlatformSetupRegisterResult;
    },
  });
}

/** Hook to request a platform password reset code. */
export function usePlatformPasswordForgot() {
  return useMutation({
    mutationFn: async (input: PlatformPasswordForgotInput) => {
      const res = await apiContract.platform.passwordForgot({ body: input });
      return res.body as PlatformPasswordForgotResult;
    },
  });
}

/** Hook to complete platform password reset with OTP code and new password. */
export function usePlatformPasswordReset() {
  return useMutation({
    mutationFn: async (input: PlatformPasswordResetInput) => {
      const res = await apiContract.platform.passwordReset({ body: input });
      return res.body as { user: PlatformUser };
    },
  });
}

/** Hook to resend platform password reset code. */
export function usePlatformPasswordResetResend() {
  return useMutation({
    mutationFn: async (resetId: string) => {
      const res = await apiContract.platform.passwordResend({ body: { resetId } });
      return res.body as PlatformPasswordForgotResult;
    },
  });
}
