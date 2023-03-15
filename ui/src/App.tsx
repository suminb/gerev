import * as React from "react";


import EnterImage from './assets/images/enter.svg';
import { GiSocks } from "react-icons/gi";

import './assets/css/App.css';
import SearchBar from "./components/search-bar";
import { SearchResult, SearchResultProps } from "./components/search-result";
import { addToSearchHistory } from "./autocomplete";
import DataSourcePanel from "./components/data-source-panel";
import Modal from 'react-modal';
import { api } from "./api";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { ClipLoader } from "react-spinners";
import { FiSettings } from "react-icons/fi";

export interface AppState {
  query: string
  results: SearchResultProps[]
  searchDuration: number
  isLoading: boolean
  isNoResults: boolean
  isModalOpen: boolean
  isServerDown: boolean
  isStartedFetching: boolean
  isPreparingIndexing: boolean
  docsLeftToIndex: number
  docsInIndexing: number
  lastServerDownTimestamp: number
}

export interface ServerStatus {
  docs_in_indexing: number
  docs_left_to_index: number
}

Modal.setAppElement('#root');

const customStyles = {
  content: {
    top: '50%',
    left: '50%',
    right: 'auto',
    bottom: 'auto',
    marginRight: '-50%',
    transform: 'translate(-50%, -50%)',
    background: '#221f2e',
    width: '50vw',
    border: 'solid #694f94 0.5px',
    borderRadius: '12px',
    padding: '0px'
  },
  overlay: {
    background: '#0000004a'
  },
  special: {
    stroke: 'white'
  }
};
export default class App extends React.Component <{}, AppState>{

  constructor() {
    super({});
    this.state = {
      query: "",
      results: [],
      isLoading: false,
      isNoResults: false,
      isModalOpen: false,
      isServerDown: false,
      isStartedFetching: false,
      isPreparingIndexing: false,
      docsLeftToIndex: 0,
      docsInIndexing: 0,
      searchDuration: 0,
      lastServerDownTimestamp: 0
    }

    this.openModal = this.openModal.bind(this); // bind the method here
    this.closeModal = this.closeModal.bind(this); // bind the method here

  }

  componentDidMount() {
    if (!this.state.isStartedFetching) {
      this.fetchStatsusForever();
      this.setState({isStartedFetching: true});
    }
  }

  async fetchStatsusForever() {
    let successSleepSeconds = 5;
    let timeBetweenFailToast = 5;
    let failSleepSeconds = 1;

    api.get<ServerStatus>('/status').then((res) => {
      if (this.state.isServerDown) {
        toast.dismiss();
        toast.success("Server online.", {autoClose: 2000});
      }

      let isPreparingIndexing = this.state.isPreparingIndexing;
      if (this.state.isPreparingIndexing && (res.data.docs_in_indexing > 0 || res.data.docs_left_to_index > 0)) {
        isPreparingIndexing = false;
      }

      if(this.state.docsInIndexing > 0 && (res.data.docs_in_indexing == 0 && res.data.docs_left_to_index == 0)) {
        toast.success("Indexing finished.", {autoClose: 2000});
      }

      this.setState({isServerDown: false, docsLeftToIndex: res.data.docs_left_to_index,
                     docsInIndexing: res.data.docs_in_indexing, isPreparingIndexing: isPreparingIndexing});
                     
      setTimeout(() => this.fetchStatsusForever(), successSleepSeconds * 1000);
    }).catch((err) => {
      this.setState({isServerDown: true});

      if (Date.now() - this.state.lastServerDownTimestamp > 5000) {  // if it's 5 seconds since last server down, show a toast
        toast.error(`Server is down, retrying in ${timeBetweenFailToast} seconds...`, {autoClose: timeBetweenFailToast * 1000});
        this.setState({lastServerDownTimestamp: Date.now()});
      }
      setTimeout(() => this.fetchStatsusForever(), failSleepSeconds * 1000);
    })    
  }

  shouldShowIndexingStatus() {
    return this.state.isPreparingIndexing || this.state.docsInIndexing > 0 || this.state.docsLeftToIndex > 0;
  }

  getIndexingStatusText() {
    if (this.state.isPreparingIndexing) {
      return "Fetching docs to index...";
    }

    if (this.state.docsInIndexing > 0) {
      let text = "Indexing " + this.state.docsInIndexing + " documents...";
      if (this.state.docsLeftToIndex > 0) {
        text += " (" + this.state.docsLeftToIndex + " left)";
      }

      return text;
    }

    if (this.state.docsLeftToIndex > 0) {
      return "Preparing to index " + this.state.docsLeftToIndex + " documents...";
    }
  }
  

  openModal() {
    this.setState({isModalOpen: true});
  }

  afterOpenModal() {
    // references are now sync'd and can be accessed.
  }

  closeModal() {
    this.setState({isModalOpen: false});
  }

  getTitleGradient() {
    if (this.state.isServerDown) {
      return "from-[#333333_24.72%] via-[#333333_50.45%] to-[#333333_74.45%]"
    }

    return "from-[#FFFFFF_24.72%] via-[#B8ADFF_50.45%] to-[#B8ADFF_74.45%]"
  }

  getSocksColor() {
    if (this.state.isServerDown) {
      return " text-[#333333]"
    }

    return " text-[#A78BF6]"
  }

  render() {
    return (
    <div>
      <ToastContainer className='z-50' theme="colored" />
      <FiSettings onClick={this.openModal} stroke={"#8983e0"} className="absolute right-0 z-30 float-right mr-6 mt-6 text-[42px] hover:cursor-pointer hover:rotate-90
         transition-all duration-300 hover:drop-shadow-2xl"></FiSettings>
      <div className={"w-[98vw] z-10" + (this.state.isModalOpen ? ' filter blur-sm' : '')}>
        {
          this.shouldShowIndexingStatus() &&
          <div className="flex flex-col items-center w-[500px] justify-center z-20 relative mx-auto top-6">
            <div className="relative self-center text-xs text-gray-300 bg-[#191919] border-[#4F4F4F] border-[.8px] font-medium font-inter rounded-full inline-block px-3 py-1 mb-6">
              <div className="text-[#E4E4E4] text-sm flex flex-row justify-center items-center">
                <ClipLoader color="#ffffff" loading={true} size={14} aria-label="Loading Spinner"/>
                <span className="ml-2">{this.getIndexingStatusText()}</span>
              </div>
            </div>
          </div>
        }
        <Modal
          isOpen={this.state.isModalOpen}
          onRequestClose={this.closeModal}
          contentLabel="Example Modal"
          style={customStyles}>
          <DataSourcePanel onClose={this.closeModal} onAdded={() => {this.setState({isPreparingIndexing: true})}}></DataSourcePanel>
        </Modal>
      
        {/* front search page*/}
        {
          this.state.results.length === 0 &&    
            <div className='relative flex flex-col items-center top-40 mx-auto w-full'>
                <h1 className='flex flex-row items-center text-7xl text-center text-white m-10'>                
                  <GiSocks className={('text-7xl text-center mt-4 mr-7' + this.getSocksColor())}></GiSocks>
                  <span className={("text-transparent	block font-source-sans-pro md:leading-normal bg-clip-text bg-gradient-to-l " + this.getTitleGradient())}>
                    gerev.ai
                  </span>
                </h1>
                <SearchBar isDisabled={this.state.isServerDown} query={this.state.query} isLoading={this.state.isLoading} showReset={this.state.results.length > 0}
                          onSearch={this.search} onQueryChange={this.handleQueryChange} onClear={this.clear} showSuggestions={true} />

                <button onClick={this.search} className="h-9 w-28 mt-8 p-3 flex items-center justify-center hover:shadow-sm
                  transition duration-150 ease-in-out hover:shadow-[#6c6c6c] bg-[#2A2A2A] rounded border-[.5px] border-[#6e6e6e88]">
                  <span className="font-bold text-[15px] text-[#B3B3B3]">Search</span>
                  <img className="ml-2" src={EnterImage}></img>
                </button>
                { this.state.isNoResults && 
                  <span className="text-[#D2D2D2] font-poppins font-medium text-base leading-[22px] mt-3">
                  </span>
                }
            </div>  
        } 

        {/* results page */}
        {
          this.state.results.length > 0 && 
          <div className="relative flex flex-row top-20 left-5 w-full">
            <span className='flex flex-row items-start text-3xl text-center text-white m-10 mx-7 mt-0'>
              <GiSocks className='text-4xl text-[#A78BF6] mx-3 my-1'></GiSocks>
              <span className="text-transparent	block font-source-sans-pro md:leading-normal bg-clip-text bg-gradient-to-l from-[#FFFFFF_24.72%] to-[#B8ADFF_74.45%]">gerev.ai</span>
            </span>
            <div className="flex flex-col items-start w-10/12">
              <SearchBar isDisabled={this.state.isServerDown}  query={this.state.query} isLoading={this.state.isLoading} showReset={this.state.results.length > 0}
                        onSearch={this.search} onQueryChange={this.handleQueryChange} onClear={this.clear} showSuggestions={true} />
              <span className="text-[#D2D2D2] font-poppins font-medium text-base leading-[22px] mt-3">
                {this.state.results.length} Results ({this.state.searchDuration} seconds)
              </span>
              <div className='w-6/12 mt-4 divide-y divide-[#3B3B3B] divide-y-[0.7px]'>
                {this.state.results.map((result, index) => {
                    return (
                      <SearchResult key={index} {...result} />
                      )
                    }
                  )}
              </div>
            </div>
          </div>
        }


      </div>
      </div>

      
    );  
  }

  handleQueryChange = (query: string) => {
    this.setState({query: query});
  }
  
  clear = () => {
    this.setState({query: "", results: []});
  }

  search = () => {
    if (this.state.query == "") {
      return;
    }

    this.setState({isLoading: true});
    let start = new Date().getTime();

    try {
        const response = api.get<SearchResultProps[]>("/search", {
          params: {
            query: this.state.query
          }
        }).then(
          response => {
            let end = new Date().getTime();
            let duartionSeconds =  (end - start) / 1000;
            this.setState({results: response.data, isLoading: false, searchDuration: duartionSeconds,
              isNoResults: response.data.length == 0
            });
            addToSearchHistory(this.state.query);
          }
        );
    } catch (error) {
      console.error(error);
    }
  };
  
}

