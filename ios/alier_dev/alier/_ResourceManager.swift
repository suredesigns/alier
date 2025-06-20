/*
Copyright 2024 Suredesigns Corp.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import Foundation
import UIKit
import PhotosUI
import MediaPlayer
import SwiftUI
import WebKit
import Combine


public struct ReturnView{
    public var selectView: String
    public var resourcePiker: ResourcePiker
    public init(selectView: String){
        self.selectView=selectView
        self.resourcePiker=ResourcePiker(selectView: selectView)
    }
    
    public func showView()->AnyView{
        return self.resourcePiker.showView(selectView: self.selectView)
    }
}

public struct ResourcePiker: View{
    public var selectView: String
    public init(selectView: String){
        self.selectView=selectView
    }
    public var body: some View {
        return self.showView(selectView: self.selectView)
    }
    
    public func showView(selectView: String) -> AnyView {
            let select=selectView
            switch select {
            case "Audio":
                return AnyView(MusicPicker())
            case "Image":
                return AnyView(ImageAndMoviePicker_UIImagePickerController())
            case "Image_":
                return AnyView(ImageAndMoviePicker_PHPickerViewController())
            case "Document":
                return AnyView(DocumentPickerController())
                
            default:
                return AnyView(DocumentPickerController())
        }
    }
    
}


/*Audio selection*/
public struct MusicPicker: UIViewControllerRepresentable {
    @EnvironmentObject  var urlPath: SelectView
    
    public func makeCoordinator() -> GetResourceCoordinator {
        GetResourceCoordinator(self,url: self.urlPath)
    }
    
    // Picker options
    public func makeUIViewController(context: UIViewControllerRepresentableContext<MusicPicker>) -> MPMediaPickerController {
        let picker = MPMediaPickerController()
        picker.allowsPickingMultipleItems = true
        picker.delegate = context.coordinator
        return picker
    }
    
    public func updateUIViewController(_ uiViewController: MPMediaPickerController, context: UIViewControllerRepresentableContext<MusicPicker>) {
    }
}

/* Photo and Movie selection. UIImagePickerController version */
public struct ImageAndMoviePicker_UIImagePickerController: UIViewControllerRepresentable {
    @EnvironmentObject  var urlPath: SelectView
    

    public func makeCoordinator() -> GetResourceCoordinator {
        GetResourceCoordinator(self,url: self.urlPath)
    }

    // Picker options
    public func makeUIViewController(context: UIViewControllerRepresentableContext<ImageAndMoviePicker_UIImagePickerController>) -> UIImagePickerController {
        let picker = UIImagePickerController()
        
        picker.allowsEditing = false
        picker.delegate = context.coordinator
        return picker
    }
    
    public func updateUIViewController(_ uiViewController: UIImagePickerController, context: UIViewControllerRepresentableContext<ImageAndMoviePicker_UIImagePickerController>) {
    }
}


/* Photo, Movie selection. PHPickerViewController version */
public struct ImageAndMoviePicker_PHPickerViewController: UIViewControllerRepresentable {
    @EnvironmentObject  var urlPath: SelectView
    

    
    public func makeCoordinator() -> GetResourceCoordinator {
        GetResourceCoordinator(self,url: self.urlPath)
        
    }
    
    // Picker options
    public func  makeUIViewController(context: UIViewControllerRepresentableContext<ImageAndMoviePicker_PHPickerViewController>) -> PHPickerViewController {
        var config =  PHPickerConfiguration()
        config.selectionLimit = 1
        
        
        let picker = PHPickerViewController(configuration: config)
        picker.delegate = context.coordinator
        return picker
    }
    
    public func updateUIViewController(_ uiViewController: PHPickerViewController, context: UIViewControllerRepresentableContext<ImageAndMoviePicker_PHPickerViewController>) {
    }
}



/*Get document*/
public struct DocumentPickerController: UIViewControllerRepresentable{
    @EnvironmentObject  var urlPath: SelectView
    public func makeCoordinator() -> GetResourceCoordinator {
        GetResourceCoordinator(self,url: self.urlPath)
    }
    
    // Picker options
    public func  makeUIViewController(context: UIViewControllerRepresentableContext<DocumentPickerController>) -> UIDocumentPickerViewController {
        var config =  PHPickerConfiguration()
        config.selectionLimit = 1
        
        //.item can select all. UTType.pdf
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.item])
        picker.delegate = context.coordinator
        return picker
    }
    
    public func updateUIViewController(_ uiViewController: UIDocumentPickerViewController, context: UIViewControllerRepresentableContext<DocumentPickerController>) {
    }
}

/**A class that distributes processing according to the type of selected resource**/
public class GetResourceCoordinator: NSObject, UINavigationControllerDelegate, MPMediaPickerControllerDelegate,UIImagePickerControllerDelegate,PHPickerViewControllerDelegate,UIDocumentPickerDelegate {
    public var parent: Any
    public var url: SelectView
    public init(_ parent: Any,url: SelectView) {
        self.parent = parent
        self.url=url
    }

    /**For Audio**/
    public func mediaPicker(_ mediaPicker: MPMediaPickerController, didPickMediaItems mediaItemCollection: MPMediaItemCollection) {
        let items = mediaItemCollection.items
        if items.isEmpty {
            // There were no items so return
            self.sendSelectedResourceURI(uri:"")
            return
        }
        let item = items[0]
        /**Pass the retrieved resource URI to JavaScript**/
        self.sendSelectedResourceURI(uri: item.assetURL?.absoluteString ?? "")
        mediaPicker.dismiss(animated: true, completion: nil)
       
    }
    
    /**Processing when Audio selection is canceled**/
    public func mediaPickerDidCancel(_ mediaPicker: MPMediaPickerController) {
        mediaPicker.dismiss(animated: true, completion: nil)
        /**Pass the retrieved resource URI to JavaScript**/
        self.sendSelectedResourceURI(uri: "")
    }


    /**For image and movie**/
    //The latest way to select multiple images
    public func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        guard let provider = results.first?.itemProvider else {
            picker.dismiss(animated: true, completion: nil)
            self.sendSelectedResourceURI(uri: "")
            return
        }
        
        let typeIdentifier_movie = UTType.movie.identifier
        let typeIdentifier_image = UTType.image.identifier
        
        if provider.hasItemConformingToTypeIdentifier(typeIdentifier_movie) {
            provider.loadFileRepresentation(forTypeIdentifier: typeIdentifier_movie) { url, error in
                if let error = error {
                    AlierLog.e(id: 0, message: "error: \(error.localizedDescription)")
                    /**Pass the retrieved resource URI to JavaScript**/
                    self.sendSelectedResourceURI(uri: "")
                    return
                }
                if let url = url {
                    let fileName = "\(Int(Date().timeIntervalSince1970)).\(url.pathExtension)"
                    let newUrl = URL(fileURLWithPath: NSTemporaryDirectory() + fileName)
                    /**Pass the retrieved resource URI to JavaScript**/
                    self.sendSelectedResourceURI(uri: newUrl.absoluteString)

                }
            }
        } else if (provider.hasItemConformingToTypeIdentifier(typeIdentifier_image)) {
            provider.loadFileRepresentation(forTypeIdentifier: typeIdentifier_image) { url, error in
                if let error = error {
                    AlierLog.e(id: 0, message: "error: \(error.localizedDescription)")
                    /**Pass the retrieved resource URI to JavaScript**/
                    self.sendSelectedResourceURI(uri: "")
                    return
                }
                if let url = url {
                    let fileName = "\(Int(Date().timeIntervalSince1970)).\(url.pathExtension)"
                    let newUrl = URL(fileURLWithPath: NSTemporaryDirectory() + fileName)
                    DispatchQueue.main.async {
                        self.url.urlPath=newUrl.absoluteString
                    }
                    /**Pass the retrieved resource URI to JavaScript**/
                    self.sendSelectedResourceURI(uri: url.absoluteString)
                }
            }
        }

        picker.dismiss(animated: true, completion: nil)
    }

    

    /**For document files**/
    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentAt url: URL) {
        self.url.urlPath=url.absoluteString
        controller.dismiss(animated: true, completion: nil)
        /**Pass the retrieved resource URI to JavaScript**/
        self.sendSelectedResourceURI(uri: url.absoluteString)
    }
    
    /**Cancel Document**/
    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController){
        controller.dismiss(animated: true, completion: nil)
        /**Pass the retrieved resource URI to JavaScript**/
        self.sendSelectedResourceURI(uri: "")
    }
    
    
    /** A function that passes the URI of the retrieved resource to JavaScript **/
    //FIXME: Pending as it is not yet clear how resources will be handled.
    public func sendSelectedResourceURI(uri: String){
    }
    
}


public final class SelectView: ObservableObject {
    @Published  public var urlPath = ""
    @Published  public var selectType=""
    @Published  public var openSheet=false
    @Published  public var returnView=ReturnView(selectView: "")
    
    public init(_ script_mediator: ScriptMediator) {
        /**Registering a function*/
        try! script_mediator.registerFunction(
            isSync: false,
            functionName: "openAudioPicker",
            function: { [weak self](_) in
                self?.openAudioPicker()
            },
            completionHandler: nil
        )
        try! script_mediator.registerFunction(
            isSync: false,
            functionName: "openImageAndMovie",
            function: { [weak self](_) in
                self?.openImageAndMovie()
            },
            completionHandler: nil
        )
        try! script_mediator.registerFunction(
            isSync: false,
            functionName: "openDocumentPicker",
            function: { [weak self](_) in
                self?.openDocumentPicker()
            },
            completionHandler: nil
        )
    }
    
    public func openPermission() {
        self.openSheet = true
    }
    
    public func openAudioPicker() {
       
        // Change the boolean for the Sheet
        self.openSheet = true
        // Specify the View type using EnvironmentObject
        self.returnView = ReturnView(selectView: "Audio")
    }
    
    public func openImageAndMovie() {
        // Change the boolean for the Sheet
        self.openSheet = true
        // Specify the View type using EnvironmentObject
        self.returnView = ReturnView(selectView: "Image_")
    }
    
    public func openDocumentPicker() {
        //Change the Boolean for the sheet
        self.openSheet = true
        // Specify the View type using EnvironmentObject
        self.returnView = ReturnView(selectView: "Document")
    }
}





