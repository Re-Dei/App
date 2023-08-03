import React from 'react';
import {withOnyx} from 'react-native-onyx';
import PropTypes from 'prop-types';
import {View} from 'react-native';
import lodashGet from 'lodash/get';
import _ from 'underscore';
import styles from '../../styles/styles';
import ScreenWrapper from '../../components/ScreenWrapper';
import HeaderView from './HeaderView';
import Navigation from '../../libs/Navigation/Navigation';
import ROUTES from '../../ROUTES';
import * as Report from '../../libs/actions/Report';
import ONYXKEYS from '../../ONYXKEYS';
import * as ReportUtils from '../../libs/ReportUtils';
import ReportActionsView from './report/ReportActionsView';
import CONST from '../../CONST';
import ReportActionsSkeletonView from '../../components/ReportActionsSkeletonView';
import reportActionPropTypes from './report/reportActionPropTypes';
import {withNetwork} from '../../components/OnyxProvider';
import compose from '../../libs/compose';
import Visibility from '../../libs/Visibility';
import networkPropTypes from '../../components/networkPropTypes';
import withWindowDimensions, {windowDimensionsPropTypes} from '../../components/withWindowDimensions';
import OfflineWithFeedback from '../../components/OfflineWithFeedback';
import ReportFooter from './report/ReportFooter';
import Banner from '../../components/Banner';
import withLocalize from '../../components/withLocalize';
import reportPropTypes from '../reportPropTypes';
import FullPageNotFoundView from '../../components/BlockingViews/FullPageNotFoundView';
import withViewportOffsetTop, {viewportOffsetTopPropTypes} from '../../components/withViewportOffsetTop';
import * as ReportActionsUtils from '../../libs/ReportActionsUtils';
import personalDetailsPropType from '../personalDetailsPropType';
import getIsReportFullyVisible from '../../libs/getIsReportFullyVisible';
import * as EmojiPickerAction from '../../libs/actions/EmojiPickerAction';
import MoneyRequestHeader from '../../components/MoneyRequestHeader';
import MoneyReportHeader from '../../components/MoneyReportHeader';
import * as ComposerActions from '../../libs/actions/Composer';
import ReportScreenContext from './ReportScreenContext';
import TaskHeaderActionButton from '../../components/TaskHeaderActionButton';
import DragAndDropProvider from '../../components/DragAndDrop/Provider';

const propTypes = {
    /** Navigation route context info provided by react navigation */
    route: PropTypes.shape({
        /** Route specific parameters used on this screen */
        params: PropTypes.shape({
            /** The ID of the report this screen should display */
            reportID: PropTypes.string,
        }).isRequired,
    }).isRequired,

    /** Tells us if the sidebar has rendered */
    isSidebarLoaded: PropTypes.bool,

    /** The report currently being looked at */
    report: reportPropTypes,

    /** Array of report actions for this report */
    reportActions: PropTypes.arrayOf(PropTypes.shape(reportActionPropTypes)),

    /** Whether the composer is full size */
    isComposerFullSize: PropTypes.bool,

    /** Beta features list */
    betas: PropTypes.arrayOf(PropTypes.string),

    /** The policies which the user has access to */
    policies: PropTypes.objectOf(
        PropTypes.shape({
            /** The policy name */
            name: PropTypes.string,

            /** The type of the policy */
            type: PropTypes.string,
        }),
    ),

    /** Information about the network */
    network: networkPropTypes.isRequired,

    /** The account manager report ID */
    accountManagerReportID: PropTypes.string,

    /** All of the personal details for everyone */
    personalDetails: PropTypes.objectOf(personalDetailsPropType),

    ...windowDimensionsPropTypes,
    ...viewportOffsetTopPropTypes,
};

const defaultProps = {
    isSidebarLoaded: false,
    reportActions: [],
    report: {
        hasOutstandingIOU: false,
        isLoadingReportActions: false,
    },
    isComposerFullSize: false,
    betas: [],
    policies: {},
    accountManagerReportID: null,
    personalDetails: {},
};

/**
 * Get the currently viewed report ID as number
 *
 * @param {Object} route
 * @param {Object} route.params
 * @param {String} route.params.reportID
 * @returns {String}
 */
function getReportID(route) {
    return String(lodashGet(route, 'params.reportID', null));
}

// Keep a reference to the list view height so we can use it when a new ReportScreen component mounts
let reportActionsListViewHeight = 0;

function ReportScreen(props) {
    const { route, errors, isSidebarLoaded, report, reportActions, isComposerFullSize, betas, policies, network, accountManagerReportID, personalDetails, ...windowDimensions } = props;

    const [skeletonViewContainerHeight, setSkeletonViewContainerHeight] = useState(reportActionsListViewHeight);
    const [isBannerVisible, setIsBannerVisible] = useState(true);
    const [isReportRemoved, setIsReportRemoved] = useState(false);
    const firstRenderRef = useRef(true);
    const flatListRef = useRef();
    const reactionListRef = useRef();

    const reportID = getReportID(route);
    const {addWorkspaceRoomOrChatPendingAction, addWorkspaceRoomOrChatErrors} = ReportUtils.getReportOfflinePendingActionAndErrors(report);
    const screenWrapperStyle = [styles.appContent, styles.flex1, {marginTop: viewportOffsetTop}];

    const isLoadingInitialReportActions = _.isEmpty(reportActions) && report.isLoadingReportActions;

    const shouldHideReport = !ReportUtils.canAccessReport(report, policies, betas);

    const isLoading = !reportID || !isSidebarLoaded || _.isEmpty(personalDetails) || firstRenderRef.current;
    firstRenderRef.current = false;

    const parentReportAction = ReportActionsUtils.getParentReportAction(report);
    const isDeletedParentAction = ReportActionsUtils.isDeletedParentAction(parentReportAction);
    const isSingleTransactionView = ReportUtils.isMoneyRequest(report);

    const policy = policies[`${ONYXKEYS.COLLECTION.POLICY}${report.policyID}`];

    const isTopMostReportId = Navigation.getTopmostReportId() === getReportID(route);

    const onSubmitComment = (text) => {
        Report.addComment(getReportID(route), text);
    };

    const isReportReadyForDisplay = () => {
        const reportIDFromPath = getReportID(route);
        const isTransitioning = report && report.reportID !== reportIDFromPath;
        return reportIDFromPath !== '' && report.reportID && !isTransitioning;
    };

    const fetchReportIfNeeded = () => {
        const reportIDFromPath = getReportID(route);
        if (!reportIDFromPath) {
            return;
        }

        if (report.reportID && report.reportID === reportIDFromPath) {
            return;
        }

        Report.openReport(reportIDFromPath);
    };

    const dismissBanner = () => {
        setIsBannerVisible(false);
    };

    const chatWithAccountManager = () => {
        Navigation.navigate(ROUTES.getReportRoute(accountManagerReportID));
    };

    let headerView = (
        <HeaderView
            reportID={reportID}
            onNavigationMenuButtonClicked={() => Navigation.goBack(ROUTES.HOME, false, true)}
            personalDetails={personalDetails}
            report={report}
        />
    );

    if (isSingleTransactionView && !isDeletedParentAction) {
        headerView = (
            <MoneyRequestHeader
                report={report}
                policies={policies}
                personalDetails={personalDetails}
                isSingleTransactionView={isSingleTransactionView}
                parentReportAction={parentReportAction}
            />
        );
    }

    if (ReportUtils.isMoneyRequestReport(report)) {
        headerView = (
            <MoneyReportHeader
                report={report}
                policies={policies}
                personalDetails={personalDetails}
                isSingleTransactionView={isSingleTransactionView}
                parentReportAction={parentReportAction}
            />
        );
    }

    useDidMount(route, report, fetchReportIfNeeded)
    useDidUpdate(report, errors, setIsReportRemoved, fetchReportIfNeeded)

    // Render the JSX for the component
    return (
        <ReportScreenContext.Provider
            value={{
                flatListRef: flatListRef.current,
                reactionListRef: reactionListRef.current,
            }}
        >
            <ScreenWrapper
                style={screenWrapperStyle}
                shouldEnableKeyboardAvoidingView={isTopMostReportId}
            >
                <FullPageNotFoundView
                    shouldShow={(!report.reportID && !report.isLoadingReportActions && !isLoading && !isReportRemoved) || shouldHideReport}
                    subtitleKey="notFound.noAccess"
                    shouldShowCloseButton={false}
                    shouldShowBackButton={isSmallScreenWidth}
                    onBackButtonPress={Navigation.goBack}
                >
                    <OfflineWithFeedback
                        pendingAction={addWorkspaceRoomOrChatPendingAction}
                        errors={addWorkspaceRoomOrChatErrors}
                        shouldShowErrorMessages={false}
                        needsOffscreenAlphaCompositing
                    >
                        {headerView}
                        {ReportUtils.isTaskReport(report) && isSmallScreenWidth && ReportUtils.isOpenTaskReport(report) && (
                            <View style={[styles.borderBottom]}>
                                <View style={[styles.appBG, styles.pl0]}>
                                    <View style={[styles.ph5, styles.pb3]}>
                                        <TaskHeaderActionButton report={report} />
                                    </View>
                                </View>
                            </View>
                        )}
                    </OfflineWithFeedback>
                    {Boolean(accountManagerReportID) && ReportUtils.isConciergeChatReport(report) && isBannerVisible && (
                            <Banner
                                containerStyles={[styles.mh4, styles.mt4, styles.p4, styles.bgDark]}
                                textStyles={[styles.colorReversed]}
                                text={translate('reportActionsView.chatWithAccountManager')}
                                onClose={dismissBanner}
                                onPress={chatWithAccountManager}
                                shouldShowCloseButton
                            />
                        )}
                        <DragAndDropProvider isDisabled={!isReportReadyForDisplay()}>
                            <View
                                style={[styles.flex1, styles.justifyContentEnd, styles.overflowHidden]}
                                onLayout={(event) => {
                                    // Rounding this value for comparison because they can look like this: 411.9999694824219
                                    const skeletonViewContainerHeight = Math.round(event.nativeEvent.layout.height);

                                    // Only set state when the height changes to avoid unnecessary renders
                                    if (reportActionsListViewHeight === skeletonViewContainerHeight) return;

                                    // The height can be 0 if the component unmounts - we are not interested in this value and want to know how much space it
                                    // takes up so we can set the skeleton view container height.
                                    if (skeletonViewContainerHeight === 0) {
                                        return;
                                    }
                                    reportActionsListViewHeight = skeletonViewContainerHeight;
                                    setSkeletonViewContainerHeight(skeletonViewContainerHeight)
                                }}
                            >
                                {isReportReadyForDisplay() && !isLoadingInitialReportActions && !isLoading && (
                                    <ReportActionsView
                                        reportActions={reportActions}
                                        report={report}
                                        isComposerFullSize={isComposerFullSize}
                                        parentViewHeight={skeletonViewContainerHeight}
                                        policy={policy}
                                    />
                                )}

                                {/* Note: The report should be allowed to mount even if the initial report actions are not loaded. If we prevent rendering the report while they are loading then
                            we'll unnecessarily unmount the ReportActionsView which will clear the new marker lines initial state. */}
                                {(!isReportReadyForDisplay() || isLoadingInitialReportActions || isLoading) && (
                                    <ReportActionsSkeletonView containerHeight={skeletonViewContainerHeight} />
                                )}

                                {isReportReadyForDisplay() && (
                                    <>
                                        <ReportFooter
                                            errors={addWorkspaceRoomOrChatErrors}
                                            pendingAction={addWorkspaceRoomOrChatPendingAction}
                                            isOffline={network.isOffline}
                                            reportActions={reportActions}
                                            report={report}
                                            isComposerFullSize={isComposerFullSize}
                                            onSubmitComment={onSubmitComment}
                                            policies={policies}
                                        />
                                    </>
                                )}

                                {!isReportReadyForDisplay() && (
                                    <ReportFooter
                                        shouldDisableCompose
                                        isOffline={network.isOffline}
                                    />
                                )}
                            </View>
                        </DragAndDropProvider>
                </FullPageNotFoundView>
            </ScreenWrapper>
        </ReportScreenContext.Provider>
    );
};

/**
 * @param {*} route 
 * @param {*} report 
 * @param {Function} fetchReportIfNeeded 
 */
function useDidMount(route, report, fetchReportIfNeeded) {
    useEffect(() => {
        const unsubscribeVisibilityListener = Visibility.onVisibilityChange(() => {
            const isTopMostReportId = Navigation.getTopmostReportId() === getReportID(route);

            // If the report is not fully visible (AKA on small screen devices and LHR is open) or the report is optimistic (AKA not yet created)
            // we don't need to call openReport
            if (!getIsReportFullyVisible(isTopMostReportId) || report.isOptimisticReport) {
                return;
            }

            Report.openReport(report.reportID);
        });

        fetchReportIfNeeded();
        ComposerActions.setShouldShowComposeInput(true);

        return () => {
            if (unsubscribeVisibilityListener) {
                unsubscribeVisibilityListener();
            }
        };
    }, []);
}

function useDidUpdate(report, errors, setIsReportRemoved, fetchReportIfNeeded) {
    const [prevReport, setPrevReport] = useState(report);

    useEffect(() => {
        if (ReportUtils.shouldHideComposer(report, errors)) {
            EmojiPickerAction.hideEmojiPicker(true);
        }
        const onyxReportID = report.reportID;
        const prevOnyxReportID = prevReport.reportID;
        const routeReportID = getReportID(route);

        // navigate to concierge when the room removed from another device (e.g. user leaving a room)
        // the report will not really null when removed, it will have defaultProps properties and values
        if (
            prevOnyxReportID &&
            prevOnyxReportID === routeReportID &&
            !onyxReportID &&
            // non-optimistic case
            (_.isEqual(report, defaultProps.report) ||
                // optimistic case
                (prevReport.statusNum === CONST.REPORT.STATUS.OPEN && report.statusNum === CONST.REPORT.STATUS.CLOSED))
        ) {
            Navigation.goBack();
            Report.navigateToConciergeChat();
            // isReportRemoved will prevent <FullPageNotFoundView> showing when navigating
            setIsReportRemoved(true);
            setPrevReport(report)
            return;
        }

        if (onyxReportID === prevOnyxReportID && (!onyxReportID || onyxReportID === routeReportID)) {
            return;
        }

        fetchReportIfNeeded();
        ComposerActions.setShouldShowComposeInput(true);
        setPrevReport(report)
    }, [report, route]);
}

ReportScreen.propTypes = propTypes;
ReportScreen.defaultProps = defaultProps;

export default compose(
    withViewportOffsetTop,
    withLocalize,
    withWindowDimensions,
    withNetwork(),
    withOnyx({
        isSidebarLoaded: {
            key: ONYXKEYS.IS_SIDEBAR_LOADED,
        },
        reportActions: {
            key: ({route}) => `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${getReportID(route)}`,
            canEvict: false,
            selector: ReportActionsUtils.getSortedReportActionsForDisplay,
        },
        report: {
            key: ({route}) => `${ONYXKEYS.COLLECTION.REPORT}${getReportID(route)}`,
        },
        isComposerFullSize: {
            key: ({route}) => `${ONYXKEYS.COLLECTION.REPORT_IS_COMPOSER_FULL_SIZE}${getReportID(route)}`,
        },
        betas: {
            key: ONYXKEYS.BETAS,
        },
        policies: {
            key: ONYXKEYS.COLLECTION.POLICY,
        },
        accountManagerReportID: {
            key: ONYXKEYS.ACCOUNT_MANAGER_REPORT_ID,
        },
        personalDetails: {
            key: ONYXKEYS.PERSONAL_DETAILS_LIST,
        },
    }),
)(ReportScreen);
