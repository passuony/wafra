import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { LanguageProvider } from "@/components/LanguageProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Home from "@/pages/home";
import Login from "@/pages/login";
import Restaurants from "@/pages/restaurants";
import Charities from "@/pages/charities";
import AdminDashboard from "@/pages/admin";
import Profile from "@/pages/profile";
import Notifications from "@/pages/notifications";
import About from "@/pages/about";
import FAQ from "@/pages/faq";
import Contact from "@/pages/contact";
import CharityBaskets from "@/pages/charity-baskets";
import CharityDeliveries from "@/pages/charity-deliveries";
import RestaurantBaskets from "@/pages/restaurant-baskets";
import DeliveryPage from "@/pages/delivery";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/restaurants" component={Restaurants} />
      <Route path="/charities" component={Charities} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/profile" component={Profile} />
      <Route path="/notifications" component={Notifications} />
      <Route path="/about" component={About} />
      <Route path="/faq" component={FAQ} />
      <Route path="/contact" component={Contact} />
      <Route path="/charity/baskets" component={CharityBaskets} />
      <Route path="/charity/deliveries" component={CharityDeliveries} />
      <Route path="/restaurant/baskets" component={RestaurantBaskets} />
      <Route path="/delivery" component={DeliveryPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <TooltipProvider>
              <Toaster />
              <ErrorBoundary>
                <Router />
              </ErrorBoundary>
            </TooltipProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}

export default App;
