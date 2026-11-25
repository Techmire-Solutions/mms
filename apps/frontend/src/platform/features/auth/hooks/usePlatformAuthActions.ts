import { useMutation } from "@tanstack/react-query";
import type {
  PlatformPasswordForgotInput,
  PlatformPasswordForgotResult,
  PlatformPasswordResetInput,
  PlatformSetupRegisterInput,
  PlatformSetupRegisterResult,
  PlatformUser,
} from "@mms/contracts";
import { apiContract } from "@/lib/api";
import { assertContractOk } from "@/lib/apiContractError";

/** Hook to start platform setup registration. */
export function usePlatformSetupRegister() {
  return useMutation({
    mutationFn: async (input: PlatformSetupRegisterInput) => {
      const res = await apiContract.platform.setupRegister({ body: input });
      assertContractOk(res, "Failed to register platform setup");
      return res.body as PlatformSetupRegisterResult;
    },
  });
}

/** Hook to request a platform password reset code. */
export function usePlatformPasswordForgot() {
  return useMutation({
    mutationFn: async (input: PlatformPasswordForgotInput) => {
      const res = await apiContract.platform.passwordForgot({ body: input });
      assertContractOk(res, "Failed to request password reset");
      return res.body as PlatformPasswordForgotResult;
    },
  });
}

/** Hook to complete platform password reset with OTP code and new password. */
export function usePlatformPasswordReset() {
  return useMutation({
    mutationFn: async (input: PlatformPasswordResetInput) => {
      const res = await apiContract.platform.passwordReset({ body: input });
      assertContractOk(res, "Failed to reset password");
      return res.body as { user: PlatformUser };
    },
  });
}

/** Hook to resend platform password reset code. */
export function usePlatformPasswordResetResend() {
  return useMutation({
    mutationFn: async (resetId: string) => {
      const res = await apiContract.platform.passwordResend({ body: { resetId } });
      assertContractOk(res, "Failed to resend reset code");
      return res.body as PlatformPasswordForgotResult;
    },
  });
}
