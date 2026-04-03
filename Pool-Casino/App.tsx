import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { Layout } from "@/components/layout";
import { MultiplayerProvider } from "@/context/MultiplayerContext";
import { MatchmakingBar } from "@/components/MatchmakingBar";
import Home from "@/pages/home";
import Games from "@/pages/games";
import Roulette from "@/pages/roulette";
import Plinko from "@/pages/plinko";
import Dice from "@/pages/dice";
import CoinFlip from "@/pages/coinflip";
import Crash from "@/pages/crash";
import Slots from "@/pages/slots";
import Wheel from "@/pages/wheel";
import Guess from "@/pages/guess";
import Mines from "@/pages/mines";
import Blackjack from "@/pages/blackjack";
import HighLow from "@/pages/highlow";
import DoubleDice from "@/pages/doubledice";
import Ladder from "@/pages/ladder";
import War from "@/pages/war";
import Target from "@/pages/target";
import IceBreak from "@/pages/icebreak";
import AdvWheel from "@/pages/advwheel";
import RangeBet from "@/pages/range";
import Pyramid from "@/pages/pyramid";
import Lightning from "@/pages/lightning";
import Multiplayer from "@/pages/multiplayer";
import WarPvP from "@/pages/war-pvp";
import HighLowPvP from "@/pages/highlow-pvp";
import CoinFlipPvP from "@/pages/coinflip-pvp";
import RPSPvP from "@/pages/rps-pvp";
import DiceBattlePvP from "@/pages/dicebattle-pvp";
import NumGuessPvP from "@/pages/numguess-pvp";
import ReactionPvP from "@/pages/reaction-pvp";
import QuickMathPvP from "@/pages/quickmath-pvp";
import TugOfWarPvP from "@/pages/tugofwar-pvp";
import LastManPvP from "@/pages/lastman-pvp";
import BJPvPPage from "@/pages/bjpvp-pvp";
import PokerPvP from "@/pages/poker-pvp";
import CardRacePvP from "@/pages/cardrace-pvp";
import SpeedClickPvP from "@/pages/speedclick-pvp";
import MemoryPvP from "@/pages/memory-pvp";
import SplitOrStealPvP from "@/pages/splitorsteal-pvp";
import RiskDicePvP from "@/pages/riskdice-pvp";
import DuelFlipPvP from "@/pages/duelflip-pvp";
import RiskAuctionPvP from "@/pages/riskauction-pvp";
import QuickDrawPvP from "@/pages/quickdraw-pvp";
import BalanceBattlePvP from "@/pages/balancebattle-pvp";
import BlindDraw from "@/pages/blinddraw";
import HiddenPath from "@/pages/hiddenpath";
import JackpotHunt from "@/pages/jackpothunt";
import TargetHit from "@/pages/targethit";
import ChainReaction from "@/pages/chainreaction";
import TimedSafe from "@/pages/timedsafe";
import ReverseCrash from "@/pages/reversecrash";
import Countdown from "@/pages/countdown";
import CardStack from "@/pages/cardstack";
import PowerGrid from "@/pages/powergrid";
import ElimWheel from "@/pages/elimwheel";
import ComboBuilder from "@/pages/combobuilder";
import SafeSteps from "@/pages/safesteps";
import PredChain from "@/pages/predchain";
import Badges from "@/pages/badges";
import Casinos from "@/pages/casinos";
import CasinoHub from "@/pages/casino-hub";
import Profile from "@/pages/profile";
import PlayerProfile from "@/pages/player";
import Admin from "@/pages/admin";
import Chat from "@/pages/chat";
import Notifications from "@/pages/notifications";
import Leaderboard from "@/pages/leaderboard";
import { Login, Register } from "@/pages/auth";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/games" component={Games} />
        <Route path="/games/roulette" component={Roulette} />
        <Route path="/games/plinko" component={Plinko} />
        <Route path="/games/dice" component={Dice} />
        <Route path="/games/coinflip" component={CoinFlip} />
        <Route path="/games/crash" component={Crash} />
        <Route path="/games/slots" component={Slots} />
        <Route path="/games/wheel" component={Wheel} />
        <Route path="/games/guess" component={Guess} />
        <Route path="/games/mines" component={Mines} />
        <Route path="/games/blackjack" component={Blackjack} />
        <Route path="/games/highlow" component={HighLow} />
        <Route path="/games/doubledice" component={DoubleDice} />
        <Route path="/games/ladder" component={Ladder} />
        <Route path="/games/war" component={War} />
        <Route path="/games/target" component={Target} />
        <Route path="/games/icebreak" component={IceBreak} />
        <Route path="/games/advwheel" component={AdvWheel} />
        <Route path="/games/range" component={RangeBet} />
        <Route path="/games/pyramid" component={Pyramid} />
        <Route path="/games/lightning" component={Lightning} />
        <Route path="/multiplayer" component={Multiplayer} />
        <Route path="/multiplayer/war" component={WarPvP} />
        <Route path="/multiplayer/highlow" component={HighLowPvP} />
        <Route path="/multiplayer/coinflip" component={CoinFlipPvP} />
        <Route path="/multiplayer/rps" component={RPSPvP} />
        <Route path="/multiplayer/dicebattle" component={DiceBattlePvP} />
        <Route path="/multiplayer/numguess" component={NumGuessPvP} />
        <Route path="/multiplayer/reaction" component={ReactionPvP} />
        <Route path="/multiplayer/quickmath" component={QuickMathPvP} />
        <Route path="/multiplayer/tugofwar" component={TugOfWarPvP} />
        <Route path="/multiplayer/lastman" component={LastManPvP} />
        <Route path="/multiplayer/bjpvp" component={BJPvPPage} />
        <Route path="/multiplayer/poker" component={PokerPvP} />
        <Route path="/multiplayer/cardrace" component={CardRacePvP} />
        <Route path="/multiplayer/speedclick" component={SpeedClickPvP} />
        <Route path="/multiplayer/memory" component={MemoryPvP} />
        <Route path="/multiplayer/splitorsteal" component={SplitOrStealPvP} />
        <Route path="/multiplayer/riskdice" component={RiskDicePvP} />
        <Route path="/multiplayer/duelflip" component={DuelFlipPvP} />
        <Route path="/multiplayer/riskauction" component={RiskAuctionPvP} />
        <Route path="/multiplayer/quickdraw" component={QuickDrawPvP} />
        <Route path="/multiplayer/balancebattle" component={BalanceBattlePvP} />
        <Route path="/games/blinddraw" component={BlindDraw} />
        <Route path="/games/hiddenpath" component={HiddenPath} />
        <Route path="/games/jackpothunt" component={JackpotHunt} />
        <Route path="/games/targethit" component={TargetHit} />
        <Route path="/games/chainreaction" component={ChainReaction} />
        <Route path="/games/timedsafe" component={TimedSafe} />
        <Route path="/games/reversecrash" component={ReverseCrash} />
        <Route path="/games/countdown" component={Countdown} />
        <Route path="/games/cardstack" component={CardStack} />
        <Route path="/games/powergrid" component={PowerGrid} />
        <Route path="/games/elimwheel" component={ElimWheel} />
        <Route path="/games/combobuilder" component={ComboBuilder} />
        <Route path="/games/safesteps" component={SafeSteps} />
        <Route path="/games/predchain" component={PredChain} />
        <Route path="/badges" component={Badges} />
        <Route path="/casinos" component={Casinos} />
        <Route path="/casino/:id" component={CasinoHub} />
        <Route path="/profile" component={Profile} />
        <Route path="/player/:username" component={PlayerProfile} />
        <Route path="/admin" component={Admin} />
        <Route path="/chat" component={Chat} />
        <Route path="/notifications" component={Notifications} />
        <Route path="/leaderboard" component={Leaderboard} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <MultiplayerProvider>
            <Router />
            <MatchmakingBar />
          </MultiplayerProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
