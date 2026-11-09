import status from "http-status";
import AppError from "../../errorHelpers/AppError.js";
import { prisma } from "../../lib/prisma.js";
import { WalletTransactionType, WalletTransactionReason } from "../../constants/prismaEnums.js";

const getOrCreateWallet = async (userId: string, tx: any = prisma) => {
    let wallet = await tx.wallet.findUnique({
        where: { userId }
    });

    if (!wallet) {
        wallet = await tx.wallet.create({
            data: {
                userId,
                balance: 0,
                currency: "USD"
            }
        });
    }

    return wallet;
};

const getMyWallet = async (userId: string) => {
    const wallet = await getOrCreateWallet(userId);

    const transactions = await prisma.walletTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: "desc" },
        include: {
            rentalBooking: {
                include: {
                    vehicle: {
                        select: { make: true, model: true, year: true, licensePlate: true }
                    }
                }
            },
            serviceRequest: {
                select: { id: true, serviceName: true, serviceType: true, scheduledDate: true }
            }
        }
    });

    return {
        wallet,
        transactions
    };
};

interface ICreditRefundParams {
    userId: string;
    refundAmount: number;
    cancellationFee: number;
    description: string;
    rentalBookingId?: string;
    serviceRequestId?: string;
    referenceId?: string;
}

const creditRefund = async (tx: any, params: ICreditRefundParams) => {
    const { userId, refundAmount, cancellationFee, description, rentalBookingId, serviceRequestId, referenceId } = params;

    const wallet = await getOrCreateWallet(userId, tx);

    // Increment balance
    const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
            balance: {
                increment: refundAmount
            }
        }
    });

    // Create ledger transaction
    const transaction = await tx.walletTransaction.create({
        data: {
            walletId: wallet.id,
            amount: refundAmount,
            type: WalletTransactionType.CREDIT,
            reason: WalletTransactionReason.REFUND,
            description,
            cancellationFee,
            refundAmount,
            rentalBookingId: rentalBookingId || null,
            serviceRequestId: serviceRequestId || null,
            referenceId: referenceId || rentalBookingId || serviceRequestId || null
        }
    });

    return { wallet: updatedWallet, transaction };
};

export const WalletService = {
    getOrCreateWallet,
    getMyWallet,
    creditRefund
};
