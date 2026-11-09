import Stripe from "stripe";
import { envVars } from "./env.js";

export const stripe = new Stripe(envVars.STRIPE.STRIPE_SECRET_KEY)