#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(QRBeamNative, NSObject)

RCT_EXTERN_METHOD(getPendingSharedFile:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(clearPendingSharedFile:(NSString *)shareId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(setIdleTimerDisabled:(BOOL)enabled)

@end
